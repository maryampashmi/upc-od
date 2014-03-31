angular.module('odIntegrator', ['ngRoute', 'ngResource', 'ngAnimate', 'mgcrea.ngStrap'])
.config(function($routeProvider, $locationProvider) {
  $locationProvider.html5Mode(true);
  $routeProvider
  .when('/', {
    'templateUrl': '/partials/home.html',
    'navItem': 'home'
  })
  .when('/schema', {
    'templateUrl': '/partials/schema-overview.html',
    'navItem': 'schema'
  })
  .when('/sources', {
    'templateUrl': '/partials/sources-overview.html',
    'navItem': 'sources'
  })
  .when('/sources/create', {
    'templateUrl': '/partials/sources-create.html',
    'navItem': 'sources'
  })
  .when('/sources/edit/:id', {
    'templateUrl': '/partials/sources-edit.html',
    'navItem': 'sources'
  })
  .otherwise({
    'redirectTo': '/'
  });
})
.config(['$compileProvider', function($compileProvider){
  $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|data):/);
}])
.config(['$alertProvider', function($alertProvider) {
  angular.extend($alertProvider.defaults, {
    animation: 'am-fade-and-slide-top',
    container: '#alert-container'
  });
}])
.directive('staticInclude', ['$http', '$templateCache', '$compile', function($http, $templateCache, $compile) {
  return function(scope, element, attrs) {
    var templatePath = attrs.staticInclude;
    $http.get(templatePath, {cache: $templateCache}).success(function(response) {
      element.html(response);
      $compile(element.contents())(scope);
    });
  };
}])
.controller('Navigation', ['$scope', '$route', function($scope, $route) {
  $scope.$on("$routeChangeSuccess", function(evt, routeData) {
    $scope.navItem = $route.current.navItem;
  });
}])
.controller('SchemaEditor', ['$scope', '$http', function($scope, $http) {
  $http({method:'GET', url:'/api/schema'}).success(function(data, statusCode) {
    $scope.schema = data;
  }).error(function(data, statusCode) {
    alert("Unable to fetch schema");
  });
  $scope.editEntity = function(a) {
    alert("Editing " + a);
  };
  $scope.createEntity = function() {
    alert("Creating " + $scope.newEntityName);
  };
}])
.factory('Sources', ['$resource', function($ressource) {
  return $ressource('/api/sources/:_id', {_id: "@_id"}, {
    'replace': {method: 'PUT'}
  });
}])
.controller('SourceOverview', ['$scope', '$sce', 'Sources', '$alert', function($scope, $sce, Sources, $alert) {
  function loadSources() {
    $scope.state = "loading";
    Sources.query(function(sources) {
      $scope.sources = sources;
      $scope.state = "ready";
    }, function(errMessage) {
      $scope.state = "error";
    });
  }
  $scope.reload = loadSources;
  function updateDonwlodLink() {
    $scope.downloadLink = 'data:application/json;charset=utf-8,' + encodeURIComponent(angular.toJson($scope.sources));
  }
  $scope['updateDownloadLink'] = updateDonwlodLink;
  $scope['deleting'] = {};
  $scope['sourcesImport'] = [];
  $scope['sourcesImport']['replace'] = true;
  function importSources() {
    var fileInput = document.getElementById('sourcesImportFile');
    if(fileInput.files.length < 1) {
      $alert({title: "Error:", content: $sce.trustAsHtml("Please select a file"), type: 'danger', duration: 3});
    } else {
      $scope.sourcesImport.working = true;
      var reader = new FileReader();
      reader.onload = function(e) {
        var text = reader['result'];
        try {
          var importedSources = JSON.parse(text);
        } catch(e) {
          $alert({title: "Error:", content: $sce.trustAsHtml("Please select a valid JSON file"), type: 'danger', duration: 3});
          $scope.sourcesImport.working = false;
          return;
        }
        if($scope.sourcesImport.replace) {
          Sources.replace({_id: null}, importedSources, function() {
            $scope['sourcesImport']['working'] = false;
            $alert({title: "Success:", content: $sce.trustAsHtml("Sources were successfully imported"), type: 'info'});
            loadSources();
          }, function() {
            $scope['sourcesImport']['working'] = false;
            $alert({title: "Error:", content: $sce.trustAsHtml("Replace..."), type: 'danger'});
          });
        } else {
          $alert({title: "Error:", content: $sce.trustAsHtml("Not implemented so far..."), type: 'info'});
          $scope.sourcesImport.working = false;
        }
      }
      reader.onerror = function(e) {
        $alert({title: "Error:", content: $sce.trustAsHtml("Unable to read the file"), type: 'danger', duration: 3});
      }
      reader.readAsText(fileInput.files[0]);
    }
    
  }
  $scope['sourcesImport']['import'] = importSources;
  $scope.deleteSource = function(id) {
    $scope.deleting[id] = true;
    Sources.delete({_id: id}, function() {
      $scope.sources = $scope.sources.filter(function(source) {
        return source._id != id;
      });
      delete $scope.deleting[id];
    }, function() {
      delete $scope.deleting[id];
      var sourceName = '<unknown>';
      for(var i = 0; i < $scope.sources.length; i++) {
        if($scope.sources[i]._id == id) {
          sourceName = $scope.sources[i].name;
          break;
        }
      }
      sourceName = sourceName
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
      var message = "Failed to delete source " + sourceName;
      $alert({title: "Error:", content: $sce.trustAsHtml(message), type: 'danger'});
    });
  };
  loadSources();
}])
.controller('SourceCreator', ['$scope', '$alert', '$sce', '$location', 'Sources', function($scope, $alert, $sce, $location, Sources) {
  $scope.config = "{\n}";
  $scope.save = function() {
    $scope.saving = true;
    delete $scope.error;
    try {
      var config = JSON.parse($scope.config);
    } catch(e) {
      $alert({title: "Error:", content: $sce.trustAsHtml("Configuration of the source must be valid JSON"), type: 'danger'});
      $scope.saving = false;
      return;
    }
    sourceObject = {
      name: $scope.name,
      module: $scope.module,
      config: config
    }
    Sources.save(sourceObject, function() {
      $scope.saving = false;
      $location.path("/sources");
    }, function() {
      $alert({title: "Error:", content: $sce.trustAsHtml("Failed to save source"), type: 'danger'});
      $scope.saving = false;
    });
  };
}])
.controller('SourceEditor', ['$scope', '$alert', '$sce', '$location', '$routeParams', 'Sources', function($scope, $alert, $sce, $location, $routeParams, Sources) {
  $scope.state = 'loading';
  function loadSource() {
    Sources.get({_id: $routeParams.id}, function(result) {
      console.log(result);
      $scope.state = 'ready';
      $scope.name = result.name;
      $scope.module = result.module;
      $scope.config = JSON.stringify(result.config, null, 2);
    }, function(result) {
      $scope.state = 'error'
    });
  }
  $scope.load = loadSource;
  loadSource();
  $scope.save = function() {
    $scope.saving = true;
    delete $scope.error;
    try {
      var config = JSON.parse($scope.config);
    } catch(e) {
      $alert({title: "Error:", content: $sce.trustAsHtml("Configuration of the source must be valid JSON"), type: 'danger'});
      $scope.saving = false;
      return;
    }
    sourceObject = {
      _id: $routeParams.id,
      name: $scope.name,
      module: $scope.module,
      config: config
    }
    Sources.save(sourceObject, function() {
      $scope.saving = false;
      $location.path("/sources");
    }, function() {
      $alert({title: "Error:", content: $sce.trustAsHtml("Failed to save source"), type: 'danger'});
      $scope.saving = false;
    });
  };
}]);
