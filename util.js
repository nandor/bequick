// This file is part of the BeQuick game
// Licensing information can be found in the about.html file
// (C) 2012 Licker Nandor. All rights reserved.

window.requestAnimationFrame = window.requestAnimationFrame       ||
                               window.webkitRequestAnimationFrame ||
                               window.mozRequestAnimationFrame    ||
                               function (callback) {
                                   window.setTimeout(callback, 1000 / 60);
                               };                              
    
var dot = function (a, x, y)
{
    return a[0] * x + a[1] * y;
};

var lerp = function (a, b, t)
{
    return a + (b - a) * t;
};

var fade = function (t)
{
    return t * t * (3.0 - 2.0 * t);
};
