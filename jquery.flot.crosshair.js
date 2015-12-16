/* Flot plugin for showing crosshairs when the mouse hovers over the plot.

 Copyright (c) 2007-2014 IOLA and Ole Laursen.
 Licensed under the MIT license.

 The plugin supports these options:

 crosshair: {
 mode: null or "x" or "y" or "xy"
 color: color
 lineWidth: number
 }

 Set the mode to one of "x", "y" or "xy". The "x" mode enables a vertical
 crosshair that lets you trace the values on the x axis, "y" enables a
 horizontal crosshair and "xy" enables them both. "color" is the color of the
 crosshair (default is "rgba(170, 0, 0, 0.80)"), "lineWidth" is the width of
 the drawn lines (default is 1).

 The plugin also adds four public methods:

 - setCrosshair( pos )

 Set the position of the crosshair. Note that this is cleared if the user
 moves the mouse. "pos" is in coordinates of the plot and should be on the
 form { x: xpos, y: ypos } (you can use x2/x3/... if you're using multiple
 axes), which is coincidentally the same format as what you get from a
 "plothover" event. If "pos" is null, the crosshair is cleared.

 - clearCrosshair()

 Clear the crosshair.

 - lockCrosshair(pos)

 Cause the crosshair to lock to the current location, no longer updating if
 the user moves the mouse. Optionally supply a position (passed on to
 setCrosshair()) to move it to.

 Example usage:

 var myFlot = $.plot( $("#graph"), ..., { crosshair: { mode: "x" } } };
 $("#graph").bind( "plothover", function ( evt, position, item ) {
 if ( item ) {
 // Lock the crosshair to the data point being hovered
 myFlot.lockCrosshair({
 x: item.datapoint[ 0 ],
 y: item.datapoint[ 1 ]
 });
 } else {
 // Return normal crosshair operation
 myFlot.unlockCrosshair();
 }
 });

 - unlockCrosshair()

 Free the crosshair to move again after locking it.

 The plugin will also fire an event, flot.crosshair.setCrosshair, when the
 crosshair is set. The event will pass in the current crosshair arguments
 and the current plot.
 */

(function ($) {
    var options = {
        crosshair: {
            mode: null, // one of null, "x", "y" or "xy",
            color: "rgba(170, 0, 0, 0.80)",
            textColor: "black",
            font: "Arial 12px",
            lineWidth: 1,
            // label to place next to the crosshair line
            label: function() {return '';},
            lineDashed: false,
            padding: {
                top: 10,
                left: -4
            }
        }
    };

    function init(plot) {
        // position of crosshair in pixels
        var crosshair = { x: -1, y: -1, locked: false, showLabel: true };

        plot.setRawCrosshair = function setCrosshairRaw(nextCrosshair) {
            crosshair = nextCrosshair;
            plot.triggerRedrawOverlay();
        };

        plot.setCrosshair = function setCrosshair(pos) {
            if (!pos)
                crosshair.x = -1;
            else {
                var o = plot.p2c(pos);
                crosshair.x = Math.max(0, Math.min(o.left, plot.width()));
                crosshair.y = Math.max(0, Math.min(o.top, plot.height()));
            }

            plot.triggerRedrawOverlay();
        };

        plot.clearCrosshair = plot.setCrosshair; // passes null for pos

        plot.lockCrosshair = function lockCrosshair(pos) {
            if (pos)
                plot.setCrosshair(pos);
            crosshair.locked = true;
        };

        plot.unlockCrosshair = function unlockCrosshair() {
            crosshair.locked = false;
        };

        plot.isLockedCrosshair = function isLockedCrosshair() {
            return crosshair.locked;
        };

        plot.showLabelCrosshair = function showLabelCrosshair() {
            crosshair.showLabel = true;
            plot.triggerRedrawOverlay();
        };

        plot.hideLabelCrosshair = function hideLabelCrosshair() {
            crosshair.showLabel = false;
            plot.triggerRedrawOverlay();
        };

        function onMouseOut(e) {
            if (crosshair.locked)
                return;

            if (crosshair.x != -1) {
                crosshair.x = -1;
                plot.triggerRedrawOverlay();
            }
            plot.getPlaceholder().trigger("flot.crosshair.setCrosshair", [crosshair]);
        }

        function onMouseMove(e) {
            if (crosshair.locked)
                return;

            if (plot.getSelection && plot.getSelection()) {
                crosshair.x = -1; // hide the crosshair while selecting
                return;
            }

            var offset = plot.offset();
            crosshair.x = Math.max(0, Math.min(e.pageX - offset.left, plot.width()));
            crosshair.y = Math.max(0, Math.min(e.pageY - offset.top, plot.height()));
            // fire an event that the crosshair has been updated
            plot.getPlaceholder().trigger("flot.crosshair.setCrosshair", [crosshair, plot]);
            plot.triggerRedrawOverlay();
        }

        plot.hooks.bindEvents.push(function (plot, eventHolder) {
            if (!plot.getOptions().crosshair.mode)
                return;

            eventHolder.mouseout(onMouseOut);
            eventHolder.mousemove(onMouseMove);
        });

        plot.hooks.drawOverlay.push(function (plot, ctx) {
            var options = plot.getOptions();
            var c = options.crosshair;
            if (!c.mode)
                return;

            var plotOffset = plot.getPlotOffset();

            ctx.save();
            ctx.translate(plotOffset.left, plotOffset.top);

            if (crosshair.x != -1) {
                var adj = options.crosshair.lineWidth % 2 ? 0.5 : 0;
                var xOffset = 0;
                var yOffset = 0;

                ctx.strokeStyle = c.color;
                ctx.lineWidth = c.lineWidth;
                ctx.lineJoin = "round";
                if (c.lineDashed) {
                    ctx.setLineDash([ctx.lineWidth * 2]);
                }

                ctx.beginPath();
                if (c.mode.indexOf("x") != -1) {
                    var drawX = Math.floor(crosshair.x) + adj;
                    ctx.moveTo(drawX, 0);
                    ctx.lineTo(drawX, plot.height());
                    xOffset = crosshair.x;
                }
                if (c.mode.indexOf("y") != -1) {
                    var drawY = Math.floor(crosshair.y) + adj;
                    ctx.moveTo(0, drawY);
                    ctx.lineTo(plot.width(), drawY);
                    xOffset = crosshair.x;
                    yOffset = crosshair.y;
                }
                ctx.stroke();
                // draw the text
                if (crosshair.showLabel) {
                    var pointInDataSpace = plot.c2p({
                        left: crosshair.x,
                        top: crosshair.y
                    });
                    var text = c.label(pointInDataSpace);
                    if (text) {
                        var padding = options.crosshair.padding;
                        ctx.font = options.crosshair.font;
                        ctx.fillStyle = options.crosshair.textColor;
                        var textSize = ctx.measureText(text);
                        var labelX,
                            labelY;

                        // Flip left/right to prevent text from going off edge of plot
                        if (xOffset + padding.left < textSize.width) {
                            ctx.textAlign = "left";
                            labelX = xOffset - padding.left;
                        } else {
                            ctx.textAlign = "right";
                            labelX = xOffset + padding.left;
                        }
                        // Flip up/down to prevent text from going off edge of plot
                        // measureText doesn't give a height, use 50 to be safe
                        if (yOffset >= 50 || c.mode.indexOf("y") === -1) {
                            ctx.textBaseline = "alphabetic";
                            labelY = yOffset + padding.top;
                        } else {
                            ctx.textBaseline = "hanging";
                            labelY = yOffset - padding.top;
                        }
                        ctx.fillText(text, labelX, labelY);
                    }
                }
            }
            ctx.restore();
        });

        plot.hooks.shutdown.push(function (plot, eventHolder) {
            eventHolder.unbind("mouseout", onMouseOut);
            eventHolder.unbind("mousemove", onMouseMove);
        });
    }

    $.plot.plugins.push({
        init: init,
        options: options,
        name: 'crosshair',
        version: '1.0'
    });
})(jQuery);
