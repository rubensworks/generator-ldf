var generators = require('yeoman-generator'),
    ldf        = require('ldf-server');

var datasourceFilter = [
    'Datasource',
    'EmptyDatasource',
    'IndexDatasource',
    'MemoryDatasource'
];

var datasourcePropertiesFilters = {
    file: [
        'ExternalHdtDatasource',
        'HdtDatasource',
        'JsonLdDatasource',
        'TurtleDatasource'
    ],
    url: [
        'JsonLdDatasource',
        'TurtleDatasource'
    ],
    endpoint: [
        'SparqlDatasource'
    ],
    defaultGraph: [
        'SparqlDatasource'
    ]
};

var MyBase = generators.Base.extend({
    // Fetch all datasources that are available in the installed ldf server
    getDatasources : function() {
        return Object.keys(ldf.datasources).filter(function(datasource) { return datasourceFilter.indexOf(datasource) === -1 });
    },

    /**
     * Initiate a loop of prompts.
     * @param message The first message to show as prompt to ask the user to confirm the iteration.
     * @param messageNext The message to show as non-first prompt to ask the user to confirm the iteration.
     * @param onLoop The callback each time the user accepts the loop iteration.
     *               This callback takes one `done()` function.
     * @param done
     */
    loopPrompt : function(message, messageNext, onLoop, done) {
        this.prompt({
            name    : '_loop',
            message : message,
            type    : 'confirm'
        }, function(props) {
            if(props._loop) {
                onLoop.call(this, function() {
                    this.loopPrompt(messageNext, messageNext, onLoop, done);
                }.bind(this));
            } else {
                done();
            }
        }.bind(this));
    },

    // Checks if the given value contains no spaces.
    hasNoSpace: function (val) {
        return !/\s/.test(val);
    }
});

module.exports = MyBase.extend({
    constructor: function () {
        generators.Base.apply(this, arguments);
        this.argument('output', { type: String, required: false, optional: true });
    },

    // Prompt server information
    prompting0: function () {
        var done = this.async(),
            prompts = [{
                name    : 'title',
                message : 'LDF server name',
                default : 'My Linked Data Fragments server'
            }];

        this.prompt(prompts, function (props) {
            this.props = props;
            done();
        }.bind(this));
    },

    // Prompt datasources
    prompting1: function () {
        var done = this.async();
        this.datasourceChoices = this.getDatasources().map(function(datasource) {
            return {
                name  : datasource,
                value : datasource
            };
        });

        this.loopPrompt('Add a datasource?', 'Add another datasource?', function(done) {
            var prompts = [{
                name    : 'type',
                message : 'Datasource type',
                type    : 'list',
                choices : this.datasourceChoices
            }, {
                name    : '_id',
                message : 'Datasource id',
                default : function(props) {
                    return props.type.toLowerCase();
                }
            }, {
                name    : 'title',
                message : 'Datasource name',
                default : function(props) {
                    return props.type;
                }
            }, {
                name    : 'description',
                message : 'Description'
            }, {
                name    : '_overrideBlankNodePrefix',
                message : 'Custom blank node prefix?',
                type    : 'confirm'
            }, {
                name    : 'blankNodePrefix',
                message : 'Blank node prefix',
                when    : function(props) {
                    return props._overrideBlankNodePrefix;
                }
            }, {
                name    : 'file',
                message : 'Local datasource file location (optional)',
                when    : function(props) {
                    return datasourcePropertiesFilters.file.indexOf(props.type) >= 0;
                }
            }, {
                name    : 'url',
                message : 'External datasource url location',
                when    : function(props) {
                    return datasourcePropertiesFilters.url.indexOf(props.type) >= 0 && props.file == '';
                }
            }, {
                name    : 'endpoint',
                message : 'Target endpoint',
                when    : function(props) {
                    return datasourcePropertiesFilters.endpoint.indexOf(props.type) >= 0;
                }
            }, {
                name    : 'defaultGraph',
                message : 'Default graph uri',
                when    : function(props) {
                    return datasourcePropertiesFilters.defaultGraph.indexOf(props.type) >= 0;
                }
            }];
            this.prompt(prompts, function(props) {
                var id = props._id;
                for(var key in props) {
                    if(key.indexOf('_') === 0) delete props[key];
                }

                // Delete the file property if we have a set url
                if(props.url) delete props.file;

                if(!this.props.datasources) this.props.datasources = {};
                this.props.datasources[id] = props;
                done();
            }.bind(this));
        }.bind(this), done);
    },

    // Prompt prefixes
    prompting2: function () {
        var done = this.async();
        this.loopPrompt('Add a prefix?', 'Add another prefix?', function(done) {
            var prompts = [{
                name    : 'prefix',
                message : 'Prefix',
                validate : this.hasNoSpace
            }, {
                name     : 'uri',
                message  : 'Full URI',
                validate : this.hasNoSpace
            }];
            this.prompt(prompts, function(props) {
                if(!this.props.prefixes) this.props.prefixes = {};
                this.props.prefixes[props.prefix] = props.uri;
                done();
            }.bind(this));
        }.bind(this), done);
    },

    // Prompt logging
    prompting3: function() {
        var done = this.async(),
            prompts = [{
                name    : 'logging',
                message : 'Enable logging?',
                type    : 'confirm',
                default : false
            }, {
                name    : 'file',
                message : 'Logging target file',
                when    : function(props) {
                    return props.logging;
                }
            }];

        this.prompt(prompts, function (props) {
            if(props.logging) {
                this.props.logging = {
                    enabled: true,
                    file: props.file
                }
            }
            done();
        }.bind(this));
    },

    // Prompt dereferencing
    prompting4: function () {
        var done = this.async();
        this.loopPrompt('Add a dereferencer?', 'Add another dereferencer?', function(done) {
            var prompts = [{
                name    : 'pattern',
                message : 'Dereference pattern',
                validate : this.hasNoSpace
            }, {
                name     : 'target',
                message  : 'Dereference target',
                validate : this.hasNoSpace
            }];
            this.prompt(prompts, function(props) {
                if(!this.props.dereference) this.props.dereference = {};
                this.props.dereference[props.pattern] = props.target;
                done();
            }.bind(this));
        }.bind(this), done);
    },

    save: function () {
        this.fs.writeJSON(this.output || 'config.json', this.props);
    }
});
