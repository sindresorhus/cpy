'use strict';
var util = require('util');
var NestedError = require('nested-error-stacks');
var objectAssign = require('object-assign');

function CpyError(message, nested) {
	NestedError.call(this, message, nested);
	objectAssign(this, nested, {message: message});
}

util.inherits(CpyError, NestedError);

CpyError.prototype.name = 'CpyError';

module.exports = CpyError;
