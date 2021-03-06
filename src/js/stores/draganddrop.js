/*
 * Copyright (c) 2014 Adobe Systems Incorporated. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 *
 */

define(function (require, exports, module) {
    "use strict";

    var Fluxxor = require("fluxxor"),
        Immutable = require("immutable");

    var events = require("js/events");

    /**
     *
     * @constructor
     */
    var DragAndDropStore = Fluxxor.createStore({

        /**
         * All available drop targets
         * 
         * @private
         * @type {Immutable.OrderedMap<{b: bounds, 
         *                              node: DOMNode, 
         *                              keyObject: object, 
         *                              validate: function, 
         *                              onDrop: function}>}  
         */
        _dropTargets: new Immutable.OrderedMap(),

        /**
         * Currently Active drag targets
         * 
         * @private
         * @type {List} 
         */
        _dragTargets: null,

        /**
         * Currently Active drop target
         * 
         * @private
         * @type {object}
         */
        _dropTarget: null,

        /**
         * Past drag target (for maintaining position during render)
         * 
         * @private
         * @type {Object} 
         */
        _pastDragTarget: null,

        /**
         * Bounds for current drop target
         *
         * @private
         * @type {{top: number, bottom: number, left: number, right: number}} 
         */
        _currentBounds: null,

        initialize: function () {
            this.bindActions(
                events.droppable.REGISTER_DROPPABLE, this._handleRegisterDroppable,
                events.droppable.REGISTER_DRAGGING, this._handleStartDragging,
                events.droppable.DEREGISTER_DROPPABLE, this._handleDeregisterDroppable,
                events.droppable.STOP_DRAGGING, this._handleStopDragging,
                events.droppable.MOVE_AND_CHECK_BOUNDS, this.moveAndCheckBounds
            );
        },

        getState: function () {
            return {
                dragTarget: this._dragTarget,
                dropTarget: this._dropTarget,
                dragPosition: this._dragPosition,
                pastDragTarget: this._pastDragTarget
            };
        },

        _inBounds: function (bounds, point) {
            return bounds.top < point.y && bounds.bottom > point.y && bounds.left < point.x && bounds.right > point.x;
        },

        _handleStartDragging: function (payload) {
            this._dragTarget = payload;
            this.emit("change");
        },

        _handleStopDragging: function () {
            if (this._dropTarget) {
                this._dropTarget.onDrop(this._dropTarget.keyObject);
                this._dropTarget = null;
            }
            this._pastDragTarget = this._dragTarget;
            this._currentBounds = null;
            this._dragTarget = null;
            this._dragPosition = null; // Removing this causes an offset
            this.emit("change");
        },

        /**
         * Adds node to list of drop targets
         *
         * @param {object} payload
         */
        _handleRegisterDroppable: function (payload) {
            this._dropTargets = this._dropTargets.set(payload.key, {
                b: payload.bounds,
                node: payload.node,
                keyObject: payload.keyObject,
                validate: payload.validateDrop,
                onDrop: payload.onDrop
            });
        },

        _handleDeregisterDroppable: function (key) {
            this._dropTargets = this._dropTargets.delete(key);
        },

        /**
         * Calls checkBounds to 
         * Sets _dragPosition which is used for moving dragged object on screen 
         * Emits change event which causes re-render
         *
         * @param {{x: number, y: number}} point Point where event occurred
         */
        moveAndCheckBounds: function (point) {
            this.checkBounds(point);
            this._dragPosition = point;
            this.emit("change");
        },

        /**
         * Checks the bounds of all the drop targets for this point
         * Sets this._currentBounds and this._dropTarget if an intersection and valid target are found
         *
         * For speed, first checks the last bounds to see if we are still within them
         *
         * Potential things to consider for the future
         * - More actively manage the drop targets, thus making the list smaller
         * - Somehow cache getBoundingClientRect to make this faster
         * - Could consider using throttle here to stop some wasted calls - throttle around 16ms for 60fps
         *
         * @param {{x: number, y: number}} point Point were event occurred
         *
         */
        checkBounds: function (point) {
            var dragTarget = this._dragTarget,
                potentialDropTarget = this._dropTarget;

            // Check against the last bounds first instead of looking in the list every time
            if (!this._currentBounds || !(this._inBounds(this._currentBounds, point))) {
                potentialDropTarget = this._dropTargets.find(function (obj) {
                    if (dragTarget.indexOf(obj.keyObject) === -1) {
                        var bound = obj.node.getBoundingClientRect(); // Only place we use getBoundingClientRect
                        if (this._inBounds(bound, point)) {
                            this._currentBounds = bound;
                            return true;
                        }
                    }
                    return false;
                }.bind(this));
            }

            if ((potentialDropTarget && potentialDropTarget.validate(this._dragTarget, point, potentialDropTarget.b))) {
                potentialDropTarget.b = this._currentBounds;
                this._dropTarget = potentialDropTarget;
            } else {
                this._dropTarget = null;
            }
        }
    });

    module.exports = DragAndDropStore;
});
