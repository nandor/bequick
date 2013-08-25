// This file is part of the BeQuick game
// Licensing information can be found in the about.html file
// (C) 2012 Licker Nandor. All rights reserved.

var BQ = BQ || {};

(function ()
{    
    // Assets
    var SHADERS     = ["terrain", "particle", "object", "overlay"];
    var TEXTURES    = ["terrain", "particle", "spark"];
    var SOUNDS      = ["pick", "morph", "die", "shepard"];   
    var OBJECTS     = ["sphere", "arrow"];
    
    // Local configuration
    var ATTRIB = 
    {
        'aPosition':    0,
        'aNormal':      1,
        'aUV':          2
    };

    // Resource Management
    var rsCount = SHADERS.length + TEXTURES.length + SOUNDS.length + OBJECTS.length;
    var rsLoaded = 0, rsFinished = false;
    BQ.Shaders = {};
    BQ.Textures = {};
    BQ.Sounds = {};
    BQ.Objects = {};
    
    // Renderer
    var canvas, holder;
    var gl = BQ.gl = null; 
    var uModel  = mat4.create();
    var uView   = mat4.create();
    var uProj   = mat4.create();
    var uVP     = mat4.create();
    
    // Game
    var moveSpeed   = 0.15;
    var enemySpeed  = 0.11;
    var win         = false;
    var enemyMove   = false;
    var beginTime   = (new Date()).getTime();
    var endTime     = beginTime + 10000;
    
    var keyState    = {};
    var player      = null;
    var target      = null;
    var enemy       = null;
    
    BQ.Light        = [0, BQ.GetHeight(0, 0) + 3.0, 0];
    BQ.Player       = [0, BQ.GetHeight(0, 0), 0];
    BQ.Camera       = [BQ.Player[0] - 4.0, BQ.Player[1] + 8.0, BQ.Player[2] - 4.0];
    BQ.Target       = [Math.random() * 500.0 - 250.0, 0.0, Math.random() * 500.0 - 250.0];
    BQ.Target[1]    = BQ.GetHeight(BQ.Target[0], BQ.Target[2]);
    BQ.Enemy        = [Math.random() * 10.0 - 5.0, 0.0, Math.random() * 10.0 - 5.0];
    BQ.Enemy[1]     = BQ.GetHeight(BQ.Enemy[0], BQ.Enemy[2]);
    BQ.Rotation     = -Math.atan2(BQ.Target[2] - BQ.Player[2], BQ.Target[0] - BQ.Player[0]) + Math.PI / 2.0;
    
    var updateLoader = function ()
    {    
        $("#bq-rs-loaded").text(++rsLoaded);
        $("#bq-rs-prog").css("width", Math.floor(rsLoaded / rsCount * 100) + "%");
        
        if (rsLoaded == rsCount) {
            rsFinished = true;
            $("#bq-loading").hide();
        }
    }
    
    var loadShaders = function ()
    {
        var compile = function (src, type)
        {
            var shader = gl.createShader(type);
            gl.shaderSource(shader, src);
            gl.compileShader(shader);
            
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                throw gl.getShaderInfoLog(shader);
            }  
            
            return shader;
        };
        
        for (var i = SHADERS.length - 1; i >= 0; --i) {
            var prog = gl.createProgram(), data;

            gl.attachShader(prog, compile($("#" + SHADERS[i] + "-vs").text(), gl.VERTEX_SHADER));
            gl.attachShader(prog, compile($("#" + SHADERS[i] + "-fs").text(), gl.FRAGMENT_SHADER));
            
            for (attrib in ATTRIB) {
                gl.bindAttribLocation(prog, ATTRIB[attrib], attrib);
            }
            
            gl.linkProgram(prog);
            if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
                throw gl.getProgramInfoLog(prog);
            }
                        
            BQ.Shaders[SHADERS[i]] = {
                'prog': prog,
                'param': {}
            }
            
            for (var j = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS) - 1; j >= 0; --j) {
                var name = gl.getActiveUniform(prog, j).name;
                BQ.Shaders[SHADERS[i]].param[name] = gl.getUniformLocation(prog, name);
            }
            
            updateLoader();
        }
    }
    
    var loadTextures = function ()
    {
        for (var i = TEXTURES.length - 1; i >= 0; --i) {
            var img = BQ.Textures[TEXTURES[i]] = new Image();
            img.tex = gl.createTexture();
            img.onload = function () {
                gl.bindTexture(gl.TEXTURE_2D, this.tex);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
                gl.generateMipmap(gl.TEXTURE_2D);
                gl.bindTexture(gl.TEXTURE_2D, null);
            
                updateLoader();
            };
            
            img.src = "img/" + TEXTURES[i] + ".png";
        }
    }
    
    var loadSounds = function ()
    {
        for (var i = SOUNDS.length - 1; i >= 0; --i) {
            BQ.Sounds[SOUNDS[i]] = new Audio("snd/" + SOUNDS[i] + ".wav");
            updateLoader();
        }
    }
    
    var loadObjects = function ()
    {
        for (var i = OBJECTS.length - 1; i >= 0; --i) {
            var obj = BQ.Objects[OBJECTS[i]] = {};
            $.getJSON("obj/" + OBJECTS[i] + ".json", function (data) {
                var gl = BQ.gl;
                
                this.vbo = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.vertex), gl.STATIC_DRAW);
                gl.bindBuffer(gl.ARRAY_BUFFER, null);
                
                this.ibo = gl.createBuffer();
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Int16Array(data.index), gl.STATIC_DRAW);
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
                
                this.count = data.count;
                updateLoader();
            }.bind(obj));
        }
    }
    
    BQ.Update = function ()
    {
        var time = (new Date()).getTime();
        var cx = Math.floor(BQ.Player[0] / BQ.CELL_SIZE) >> 5;
        var cy = Math.floor(BQ.Player[2] / BQ.CELL_SIZE) >> 5;
        var invView = mat4.create(), up = [0, 1, 0, 0], right = [1, 0, 0, 0];
        
        if (!win) {
            var tt, str, d = [0, 0, 0], chunk;
            
            // Process input
            if (keyState['A']) {
                enemyMove = true;
                d[0] += Math.sin(BQ.Rotation + Math.PI / 2);
                d[2] += Math.cos(BQ.Rotation + Math.PI / 2);
            }
            
            if (keyState['D']) {
                enemyMove = true;
                d[0] += Math.sin(BQ.Rotation - Math.PI / 2);
                d[2] += Math.cos(BQ.Rotation - Math.PI / 2);
            }

            if (keyState['W']) {
                enemyMove = true;
                d[0] += Math.sin(BQ.Rotation);
                d[2] += Math.cos(BQ.Rotation);
            }

            if (keyState['S']) {
                enemyMove = true;
                d[0] -= Math.sin(BQ.Rotation);
                d[2] -= Math.cos(BQ.Rotation);
            }
            
            if (keyState['Q']) {
                BQ.Rotation += 0.1;
            }
            
            if (keyState['E']) {
                BQ.Rotation -= 0.1;
            }

            // Update timers            
            tt = (time - beginTime) / 1000;
            str = Math.floor(tt / 60) + " min " + Math.floor(tt % 60) + " s";
            $("#bq-timer").text(str);
                        
            tt = endTime - time;
            $("#bq-dead").text(Math.floor(tt / 1000));
            if (tt <= 0) {        
                win = true;
                $("#bq-dead").hide();
                $("#bq-win > .text").html("Your 10 seconds are over! <br />" + str);
                $("#bq-win").show();
            }
            
            
            // Move the player
            vec3.normalize(d, d);
            vec3.scale(d, d, moveSpeed);
            vec3.add(BQ.Player, BQ.Player, d);            
            BQ.Player[1] = BQ.GetHeight(BQ.Player[0], BQ.Player[2]);
            
            // Move the enemy
            if (enemyMove)
            {
                vec3.sub(d, BQ.Player, BQ.Enemy);
                if (vec3.length(d) < 0.4) {
                    win = true;
                    $("#bq-dead").hide();
                    $("#bq-win > .text").html("Gotcha! <br />" + str);
                    $("#bq-win").show();
                }
            
                vec3.normalize(d, d);
                vec3.scale(d, d, enemySpeed);
                vec3.add(BQ.Enemy, BQ.Enemy, d);
                BQ.Enemy[1] = BQ.GetHeight(BQ.Enemy[0], BQ.Enemy[2]);
            }
            
            // Check for win condition
            vec3.create();
            vec3.sub(d, BQ.Target, BQ.Player);
            if (vec3.length(d) < 0.5) {
                var str, tt;
                
                win = true;
                tt = (time - beginTime) / 1000;
                str = Math.floor(tt / 60) + " min " + tt % 60 + " s";
                
                $("#bq-win > .text").html("You have just won! <br />" + str);
                $("#bq-win").show();
            }
            
            // Check for collisions   
            for (var x = cx - 1; x <= cx + 1; ++x) {
                for (var y = cy - 1; y <= cy + 1; ++y) {
                    chunk = BQ.GetChunk(x, y);        
                    for (var i = chunk.objects.length - 1; i >= 0; --i) {
                        d = vec3.create();
                        d = vec3.sub(d, BQ.Player, chunk.objects[i].position);
                        if (Math.sqrt(d[0] * d[0] + d[2] * d[2]) < 0.75) {
                            var c = chunk.objects[i].color;
                            if (c[0] == player.color[0] && c[1] == player.color[1] && c[2] == player.color[2]) {
                                endTime = time + 10000;
                                chunk.objects.splice(i, 1);
                                BQ.Sounds["pick"].play();
                                break;
                            } else {
                                win = true;
                                $("#bq-dead").hide();
                                $("#bq-win > .text").html("Ups! Wrong color <br />" + str);
                                $("#bq-win").show();
                                BQ.Sounds["die"].play();
                            }
                        }
                    }
                    
                    for (var i = chunk.particles.length - 1; i >= 0; --i) {
                        d = vec3.create();
                        d = vec3.sub(d, BQ.Player, chunk.particles[i].position);
                        if (Math.sqrt(d[0] * d[0] + d[2] * d[2]) < 0.75) {
                            BQ.Sounds["morph"].play();
                            player.color = chunk.particles[i].color;
                            break;
                        }
                    }
                }
            }
        }
        
        // Prepare data for the renderer
        vec3.add(BQ.Camera, BQ.Player, [-4 * Math.sin(BQ.Rotation), 5, -4 * Math.cos(BQ.Rotation)]);
        vec3.add(BQ.Light, BQ.Player, [0, 3, 0]);
        
        mat4.lookAt(uView, BQ.Camera, BQ.Player, [0, 1, 0]);
        mat4.perspective(uProj, 45.0, canvas.width / canvas.height, 0.1, 100.0);
        
        mat4.identity(uVP);
        mat4.multiply(uVP, uVP, uProj);
        mat4.multiply(uVP, uVP, uView);
        
        mat4.invert(invView, uView);
        vec4.transformMat4(up, up, invView);
        vec4.transformMat4(right, right, invView);
        
        player.Update(up, right);
        target.Update(up, right);
        enemy.Update(up, right);
        for (var x = cx - 1; x <= cx + 3; ++x) {
            for (var y = cy - 1; y <= cy + 2; ++y) {
                BQ.UpdateChunk(x, y, up, right);
            }
        }
    }
    
    BQ.Render = function ()
    {
        var time = (new Date()).getTime();
        var cx = Math.floor(BQ.Player[0] / BQ.CELL_SIZE) >> 5;
        var cy = Math.floor(BQ.Player[2] / BQ.CELL_SIZE) >> 5;
        
        // Begin a new frame
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0.3, 0.3, 0.3, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        // Render the terrain
        mat4.identity(uModel);
        gl.useProgram(BQ.Shaders["terrain"].prog);
        gl.uniformMatrix4fv(BQ.Shaders["terrain"].param["uVP"], false, uVP);
        gl.uniformMatrix4fv(BQ.Shaders["terrain"].param["uModel"], false, uModel);
        gl.uniform1f(BQ.Shaders["terrain"].param["uModulate"], (Math.sin(time / 500.0) + 1.0) / 2.0);
        gl.uniform4fv(BQ.Shaders["terrain"].param["uColor"], player.color);
        gl.uniform3fv(BQ.Shaders["terrain"].param["uPosition"], BQ.Light);
        
        gl.enableVertexAttribArray(0);
        gl.enableVertexAttribArray(1);
        gl.enableVertexAttribArray(2);
        
        for (var x = cx - 1; x <= cx + 3; ++x) {
            for (var y = cy - 1; y <= cy + 2; ++y) {
                BQ.DrawChunk(x, y);
            }
        }
        
        gl.disableVertexAttribArray(2);
        gl.disableVertexAttribArray(1);
        gl.disableVertexAttribArray(0);
        
        // Render objects
        gl.enableVertexAttribArray(0);
        gl.enableVertexAttribArray(1);
        gl.enableVertexAttribArray(2);
        
        gl.useProgram(BQ.Shaders["object"].prog);
        gl.uniformMatrix4fv(BQ.Shaders["object"].param["uVP"], false, uVP);
        gl.uniform3fv(BQ.Shaders["object"].param["uPosition"], BQ.Light);
        
        for (var x = cx - 1; x <= cx + 3; ++x) {
            for (var y = cy - 1; y <= cy + 2; ++y) {
                BQ.DrawObjects(x, y);
            }
        }
        
        gl.disableVertexAttribArray(2);
        gl.disableVertexAttribArray(1);
        gl.disableVertexAttribArray(0);
        
        // Render particles  
        gl.enable(gl.BLEND);
        gl.depthMask(false);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.enableVertexAttribArray(0);
        gl.enableVertexAttribArray(2);
        
        gl.useProgram(BQ.Shaders["particle"].prog);
        gl.uniformMatrix4fv(BQ.Shaders["particle"].param["uVP"], false, uVP);
        
        mat4.identity(uModel);
        mat4.translate(uModel, uModel, BQ.Player);
        gl.uniformMatrix4fv(BQ.Shaders["particle"].param["uModel"], false, uModel);
        player.Render(); 
        
        mat4.identity(uModel);
        mat4.translate(uModel, uModel, BQ.Target);
        gl.uniformMatrix4fv(BQ.Shaders["particle"].param["uModel"], false, uModel);
        target.Render();  
        
        mat4.identity(uModel);
        mat4.translate(uModel, uModel, BQ.Enemy);
        gl.uniformMatrix4fv(BQ.Shaders["particle"].param["uModel"], false, uModel);
        enemy.Render(); 
        
        for (var x = cx - 1; x <= cx + 3; ++x) {
            for (var y = cy - 1; y <= cy + 2; ++y) {
                BQ.DrawParticles(x, y);
            }
        }
        
        gl.disableVertexAttribArray(2);
        gl.disableVertexAttribArray(0);        
        gl.disable(gl.BLEND);
        gl.depthMask(true);

        // Render overlay
        var angle = Math.atan2(BQ.Target[2] - BQ.Player[2], BQ.Target[0] - BQ.Player[0]);
        
        mat4.identity(uModel);
        mat4.translate(uModel, uModel, [0, -2, -6]); 
        mat4.rotateY(uModel, uModel, - angle - BQ.Rotation - Math.PI / 2.0);      
        
        gl.clear(gl.DEPTH_BUFFER_BIT);
        gl.enableVertexAttribArray(0);
        gl.enableVertexAttribArray(1);
        gl.enableVertexAttribArray(2);
        
        gl.useProgram(BQ.Shaders["overlay"].prog);        
        gl.uniformMatrix4fv(BQ.Shaders["overlay"].param["uVP"], false, uProj);
        gl.uniformMatrix4fv(BQ.Shaders["overlay"].param["uModel"], false, uModel);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, BQ.Objects["arrow"].vbo);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12);
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24);
    
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, BQ.Objects["arrow"].ibo);
        gl.drawElements(gl.TRIANGLES, BQ.Objects["arrow"].count, gl.UNSIGNED_SHORT, 0);
        
        gl.disableVertexAttribArray(2);
        gl.disableVertexAttribArray(1);
        gl.disableVertexAttribArray(0);
    }
            
    BQ.Init = function ()
    {
        // Retrieve the context
        if (!(holder = document.getElementById('bq-holder'))) {
            throw "Cannot find canvas holder!";
        }
        
        if (!(canvas = document.getElementById('bq-canvas'))) {
            throw "Cannot find canvas!";
        }
       
        if (!(BQ.gl = gl = canvas.getContext("webgl")) &&
            !(BQ.gl = gl = canvas.getContext("experimental-webgl"))) {
            throw "Cannot retrieve WebGL context";
        }
                
        // OpenGL settings
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        gl.frontFace(gl.CCW);
        
        // Start loading resources   
        $("#bq-rs-loaded").text(rsLoaded);
        $("#bq-rs-count").text(rsCount);     
        loadShaders();
        loadTextures();
        loadSounds();
        loadObjects();
        
        // All chunk meshes share their indices
        BQ.CHUNK_IBO = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, BQ.CHUNK_IBO );
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Int16Array(BQ.CHUNK_INDICES), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
                
        // Init particles
        player = new BQ.Particles();        
        player.color    = [0, 0, 1, 1];
        player.time     = [500.0, 1000.0];
        player.vel      = [[-0.005, 0.002], [0.009, 0.006]];
        player.max      = 20;
        
        enemy = new BQ.Particles();        
        enemy.color    = [1, 1, 1, 1];
        enemy.time     = [1000.0, 1000.0];
        enemy.vel      = [[-0.005, 0.05], [0.009, 0.05]];
        enemy.max      = 100;
        enemy.texture  = "spark"
                
        target = new BQ.Particles();
        target.color    = [1.0, 0.5, 0.0, 1.0];
        target.time     = [1000.0, 1400.0];
        target.vel      = [[-0.01, 0.004], [0.018, 0.012]];
        target.off      = [[-0.2, 0.0], [0.2, 0.0]];
        target.max      = 50;
                
        // User interface & input        
        $(window).on('keyup', function (evt) {
            switch (evt.keyCode) {
                case 37: keyState['A'] = false; break;
                case 38: keyState['W'] = false; break;
                case 39: keyState['D'] = false; break;
                case 40: keyState['S'] = false; break;
                default: keyState[String.fromCharCode(evt.keyCode)] = false;
            }           
        });
        
        $(window).on('keydown', function (evt) {
            switch (evt.keyCode) {
                case 37: keyState['A'] = true; break;
                case 38: keyState['W'] = true; break;
                case 39: keyState['D'] = true; break;
                case 40: keyState['S'] = true; break;
                default: keyState[String.fromCharCode(evt.keyCode)] = true;
            }           
        });
                        
        // Main loop
        (function loop () {
            canvas.width = $("#bq-holder").width();
            canvas.height = $("#bq-holder").height();
            
            if (rsFinished) {
                BQ.Update();
                BQ.Render();
            }
            requestAnimationFrame(loop);
        }) ();
    }
}) ();
