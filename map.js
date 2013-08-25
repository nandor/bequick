// This file is part of the BeQuick game
// Licensing information can be found in the about.html file
// (C) 2012 Licker Nandor. All rights reserved.
    
// Perlin noise is based on Stefan Gustavson's paper:
// http://staffwww.itn.liu.se/~stegu/simplexnoise/simplexnoise.pdf

var BQ = BQ || {};

(function()
{
    // Global constants
    BQ.CELL_SIZE        = 0.5;
    BQ.SEED             = Math.floor(Math.random() * 1000);
    BQ.SCALE            = 10.0;
    BQ.MAP_HEIGHT       = 5.0;
    BQ.CHUNK_INDICES    = new Array(((1 << 5) - 1) * ((1 << 5) - 1) * 6);
    BQ.CHUNK_IBO        = null;
    
    // Perlin noise
    var PERLIN_PERM = new Array(512);
    var PERLIN_GRAD = [
        [ 1, 0], [-1, 0], [ 0, 1], [ 0, -1],
        [ 1, 1], [-1, 1], [ 1,-1], [-1, -1] 
    ];
        
    // Compute the index buffer shared by all chunks
    for (var i = 0, k = 0; i < (1 << 5) - 1; ++i) {
        for (var j = 0; j < (1 << 5) - 1; ++j) {
            var i00 = ((i + 0) << 5) + j;
            var i01 = ((i + 0) << 5) + j + 1;
            var i10 = ((i + 1) << 5) + j;
            var i11 = ((i + 1) << 5) + j + 1;
            
            BQ.CHUNK_INDICES[k++] = i10;
            BQ.CHUNK_INDICES[k++] = i00;
            BQ.CHUNK_INDICES[k++] = i01;
 
            BQ.CHUNK_INDICES[k++] = i10;
            BQ.CHUNK_INDICES[k++] = i01;
            BQ.CHUNK_INDICES[k++] = i11;
        }
    }    
        
    // Generate random numbers for the permutation table using xorshift
    for (var i = 0, x = BQ.SEED, y = 362436069, z = 521288629, w = 88675123; i <= 0xFF; ++i) {
        var t = x ^ (x << 1);
        x = y; y = z; z = w;
        PERLIN_PERM[i] = PERLIN_PERM[i + 256] = (w = w ^ (w >> 19) ^ (t ^ (t >> 8))) & 0xFF;
    }
    
    // Chunk storage
    var chunks = {};      
        
    var noise = function (x, y)
    {
        var X = Math.floor(x /= BQ.SCALE);
        var Y = Math.floor(y /= BQ.SCALE);
        
        x -= X; X &= 0xFF;
        y -= Y; Y &= 0xFF;
                
        var n00 = dot(PERLIN_GRAD[PERLIN_PERM[X + 0 + PERLIN_PERM[Y + 0]] & 3], x - 0, y - 0);
        var n01 = dot(PERLIN_GRAD[PERLIN_PERM[X + 0 + PERLIN_PERM[Y + 1]] & 3], x - 0, y - 1);
        var n10 = dot(PERLIN_GRAD[PERLIN_PERM[X + 1 + PERLIN_PERM[Y + 0]] & 3], x - 1, y - 0);
        var n11 = dot(PERLIN_GRAD[PERLIN_PERM[X + 1 + PERLIN_PERM[Y + 1]] & 3], x - 1, y - 1);
        
        var u = fade(x), v = fade(y);
        return (lerp(lerp(n00, n10, u), lerp(n01, n11, u), v) + 1.0) * 0.5;
    };
        
    var initChunk = function (x, y)
    {
        var mesh = new Array((1 << 10) * 8);
        var height = new Array(1 << 10);
        var vbo, particles = [], objects = [];
        
        var ox = x * ((1 << 5) - 1);
        var oy = y * ((1 << 5) - 1);
        var gl = BQ.gl;
        var count = 0, item;
                
        for (var i = 0; i < 5; ++i) {
            item = {};
            item.model = "sphere";
            item.position = [
                (ox + Math.random() * (1 << 5) - 3.0) * BQ.CELL_SIZE, 
                0.0, 
                (oy + Math.random() * (1 << 5) - 3.0) * BQ.CELL_SIZE
            ];
            item.position[1] = BQ.GetHeight(item.position[0], item.position[2]) - 0.25;
            
            switch (Math.floor(Math.random() * 88) % 4) {
                case 0: item.color = [0, 0, 1, 1]; break;
                case 1: item.color = [1, 0, 0, 1]; break;
                case 2: item.color = [0, 1, 1, 1]; break;
                case 3: item.color = [1, 1, 0, 1]; break;
            }
            
            objects.push(item);
        }
        
        for (var i = 0; i < 4; ++i) {        
            item = new BQ.Particles();  
            item.time     = [500.0, 1000.0];
            item.vel      = [[-0.005, 0.002], [0.009, 0.006]];
            item.max      = 2;
            item.position = [
                (ox + (0.2 + Math.random() * 0.6) * (1 << 5) - 3.0) * BQ.CELL_SIZE, 
                0.0, 
                (oy + (0.2 + Math.random() * 0.6) * (1 << 5) - 3.0) * BQ.CELL_SIZE
            ];
            item.position[1] = BQ.GetHeight(item.position[0], item.position[2]) - 0.8;
                
            switch (i) {
                case 0: item.color = [0, 0, 1, 1]; break;
                case 1: item.color = [1, 0, 0, 1]; break;
                case 2: item.color = [0, 1, 1, 1]; break;
                case 3: item.color = [1, 1, 0, 1]; break;
            }
            
            particles.push(item);
        }
        
        for (var i = 0; i < (1 << 5); ++i) {
            for (var j = 0; j < (1 << 5); ++j) {
                var k = ((i << 5) + j) * 8, p, item;
                
                p = height[(i << 5) + j] = noise(ox + i, oy + j) * BQ.MAP_HEIGHT;
                                
                mesh[k++] = (ox + i) * BQ.CELL_SIZE; 
                mesh[k++] = height[(i << 5) + j]; 
                mesh[k++] = (oy + j) * BQ.CELL_SIZE;
                                
                mesh[k++] = 0.0; 
                mesh[k++] = 0.0; 
                mesh[k++] = 0.0;
                
                mesh[k++] = i / (1 << 5); 
                mesh[k++] = j / (1 << 5);
            }
        }
        
        for (var i = 0; i < (1 << 5); ++i) {
            for (var j = 0; j < (1 << 5); ++j) {
                var u, d, l, r, c;
                
                u = [(ox + i - 1) * BQ.CELL_SIZE, noise(ox + i - 1, oy + j    ) * BQ.MAP_HEIGHT, (oy + j    ) * BQ.CELL_SIZE];
                l = [(ox + i    ) * BQ.CELL_SIZE, noise(ox + i,     oy + j + 1) * BQ.MAP_HEIGHT, (oy + j + 1) * BQ.CELL_SIZE];
                d = [(ox + i + 1) * BQ.CELL_SIZE, noise(ox + i + 1, oy + j    ) * BQ.MAP_HEIGHT, (oy + j    ) * BQ.CELL_SIZE];
                r = [(ox + i    ) * BQ.CELL_SIZE, noise(ox + i,     oy + j - 1) * BQ.MAP_HEIGHT, (oy + j - 1) * BQ.CELL_SIZE];
                    
                c = [mesh[((i << 5) + j) * 8 + 0], mesh[((i << 5) + j) * 8 + 1], mesh[((i << 5) + j) * 8 + 2]];
                u[0] = c[0] - u[0]; u[1] = c[1] - u[1]; u[2] = c[2] - u[2];
                l[0] = c[0] - l[0]; l[1] = c[1] - l[1]; l[2] = c[2] - l[2];
                d[0] = c[0] - d[0]; d[1] = c[1] - d[1]; d[2] = c[2] - d[2];
                r[0] = c[0] - r[0]; r[1] = c[1] - r[1]; r[2] = c[2] - r[2];
                            
                var n = [
                    (l[1] * d[2] - l[2] * d[1]) + (d[1] * r[2] - d[2] * r[1]) + (r[1] * u[2] - r[2] * u[1]) + (u[1] * l[2] - u[2] * l[1]), 
                    (l[2] * d[0] - l[0] * d[2]) + (d[2] * r[0] - d[0] * r[2]) + (r[2] * u[0] - r[0] * u[2]) + (u[2] * l[0] - u[0] * l[2]), 
                    (l[0] * d[1] - l[1] * d[0]) + (d[0] * r[1] - d[1] * r[0]) + (r[0] * u[1] - r[1] * u[0]) + (u[0] * l[1] - u[1] * l[0])
                ];
                
                var l = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);                
                mesh[((i << 5) + j) * 8 + 3] = n[0] / l;
                mesh[((i << 5) + j) * 8 + 4] = n[1] / l;
                mesh[((i << 5) + j) * 8 + 5] = n[2] / l;
            }
        }
        
        vbo = gl.createBuffer();        
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        
        return {
            "vbo": vbo,
            "height": height,
            "particles": particles,
            "objects": objects
        };
    };
    
    BQ.GetChunk = function (x, y)
    {        
        if (!chunks[x])    chunks[x] = {};        
        if (!chunks[x][y]) chunks[x][y] = initChunk(x, y);
        return chunks[x][y];
    };
    
    BQ.DrawChunk = function (x, y)
    {
        var chunk = BQ.GetChunk(x, y), gl = BQ.gl;
        
        gl.bindTexture(gl.TEXTURE_2D, BQ.Textures["terrain"].tex);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, chunk.vbo);        
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12);
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24);
        
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, BQ.CHUNK_IBO);
        gl.drawElements(gl.TRIANGLES, BQ.CHUNK_INDICES.length, gl.UNSIGNED_SHORT, 0);
    };
    
    BQ.UpdateChunk = function (x, y, u, r)
    {
        var chunk = BQ.GetChunk(x, y);
        for (var p in chunk.particles) {
            chunk.particles[p].Update(u, r);
        }
    };
    
    BQ.DrawObjects = function (x, y)
    {
        var chunk = BQ.GetChunk(x, y), gl = BQ.gl, model = mat4.create();
        
        for (var i = chunk.objects.length - 1; i >= 0; --i)  {
            var item = chunk.objects[i];
            var object = BQ.Objects[item.model];
            
            mat4.identity(model);
            mat4.translate(model, model, item.position); 
            gl.uniformMatrix4fv(BQ.Shaders["object"].param["uModel"], false, model);
            gl.uniform4fv(BQ.Shaders["object"].param["uColor"], item.color);
            
            gl.bindBuffer(gl.ARRAY_BUFFER, object.vbo);
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
            gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12);
            gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24);
        
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, object.ibo);
            gl.drawElements(gl.TRIANGLES, object.count, gl.UNSIGNED_SHORT, 0);
        }
    };
    
    BQ.DrawParticles = function (x, y)
    {
        var chunk = BQ.GetChunk(x, y), gl = BQ.gl, model = mat4.create();
                
        for (var p in chunk.particles) {            
            mat4.identity(model);
            mat4.translate(model, model, chunk.particles[p].position);
            gl.uniformMatrix4fv(BQ.Shaders["particle"].param["uModel"], false, model);
            chunk.particles[p].Render();
        }
    };
    
    BQ.GetHeight = function (x, y)
    {                
        return noise(x / BQ.CELL_SIZE, y / BQ.CELL_SIZE) * 5.0;
    };
}) ();