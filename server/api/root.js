"use strict";
var Router = require("./router");
var connect = require("connect");
var sendJson = require("send-data/json");
var bodyParser = require("body-parser");
var delayResponse = require("./delay-response");

function handleBodyError(err, req, res, next) {
  if(err instanceof SyntaxError) {
    sendJson(req, res, {
      statusCode: 400,
      body: {"status":"error", msg: "Unable to parse request body: " + err.message}
    });
  } else {
    next(err);
  }
}

function handleApiError(err, req, res, next) {
  var statusCode = 500;
  if(err.statusCode !== undefined) {
    statusCode = err.statusCode;
  }
  var jsonResponse = {};
  if(err.message !== undefined) {
    jsonResponse.message = err.message;
  }
  sendJson(req, res, {
    statusCode: statusCode,
    body: jsonResponse
  });
}

var apiRoot = connect()
  .use(bodyParser.json())
  .use(handleBodyError)
  .use(delayResponse(300))
  .use(Router()
    .addChildRouter("/schema", require("./schema"))
    .addChildRouter("/sources", require("./sources"))
    .addChildRouter("/experiments", require("./experiments"))
  ).use(handleApiError);

module.exports = apiRoot;