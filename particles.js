// This file is part of the BeQuick game
// Licensing information can be found in the about.html file
// (C) 2012 Licker Nandor. All rights reserved.

var BQ = BQ || {};

(function ()
{    
    BQ.Particles = function ()
    {
        var gl = BQ.gl;
        
        this.color  = [0, 0, 0, 1];
        this.time   = [500.0, 1000.0];
        this.vel    = [[-0.005, 0.002], [0.009, 0.006]];
        this.off    = [[-0.2, 0.5], [0.2, 0.8]];
        this.size   = [0.5, 0.8];
        this.max    = 10;
        this.active = 0;
        this.spawn  = 1;
        this.texture = "particle";
        this.mesh = new Float32Array(this.max * 36);
        
        this.vbo = gl.createBuffer();
        this.p = new Array(this.max);
        for (var i = this.p.length - 1, t = (new Date()).getTime(); i >= 0; --i) {
            this.p[i] = {'time': t};
        }
    }
    
    BQ.Particles.prototype.Update = function (u, r)
    {    
        var time = (new Date()).getTime();
        for (var i = 0; i < this.active; ++i) {
            if (this.p[i].time <= time) {
                this.p[i] = this.p[this.active - 1];
                this.active--;
                i--;
            }
        }
        
        var newCount = Math.min(this.max, this.active ? (this.active + this.spawn) : 20);
        while (this.active < newCount) {
            this.p[this.active++] = {
                'time': time + lerp(this.time[0], this.time[1], Math.random()),
                'btime': time,
                'pos': [lerp(this.off[0][0], this.off[1][0], Math.random()), lerp(this.off[0][1], this.off[1][1], Math.random())],
                'vel': [lerp(this.vel[0][0], this.vel[1][0], Math.random()), lerp(this.vel[0][1], this.vel[1][1], Math.random())],
                'sz': lerp(this.size[0], this.size[1], Math.random())
            }
        }
        
        if (this.max > this.mesh.length / 36) {
            this.mesh = new Float32Array(this.max * 36);
        }
           
        for (var i = 0, k = 0; i < this.active; ++i) {
            var p = this.p[i], a;
            
            p.pos[0] += p.vel[0];
            p.pos[1] += p.vel[1];
            p.pos[2] = 0.0;
            a = 1.0 - (time - p.btime) / (p.time - p.btime);
            
            this.mesh[k++] = p.pos[0];
            this.mesh[k++] = p.pos[1];
            this.mesh[k++] = p.pos[2];     
            this.mesh[k++] = 0.0; this.mesh[k++] = 0.0; this.mesh[k++] = a;
            
            this.mesh[k++] = p.pos[0] + r[0] * p.sz;
            this.mesh[k++] = p.pos[1] + r[1] * p.sz
            this.mesh[k++] = p.pos[2] + r[2] * p.sz;   
            this.mesh[k++] = 1.0; this.mesh[k++] = 0.0; this.mesh[k++] = a;

            this.mesh[k++] = p.pos[0] + u[0] * p.sz;
            this.mesh[k++] = p.pos[1] + u[1] * p.sz;
            this.mesh[k++] = p.pos[2] + u[2] * p.sz;  
            this.mesh[k++] = 0.0; this.mesh[k++] = 1.0; this.mesh[k++] = a; 

            this.mesh[k++] = p.pos[0] + r[0] * p.sz;
            this.mesh[k++] = p.pos[1] + r[1] * p.sz;
            this.mesh[k++] = p.pos[2] + r[2] * p.sz; 
            this.mesh[k++] = 1.0; this.mesh[k++] = 0.0; this.mesh[k++] = a;

            this.mesh[k++] = p.pos[0] + (r[0] + u[0]) * p.sz;
            this.mesh[k++] = p.pos[1] + (r[1] + u[1]) * p.sz;
            this.mesh[k++] = p.pos[2] + (r[2] + u[2]) * p.sz;   
            this.mesh[k++] = 1.0; this.mesh[k++] = 1.0; this.mesh[k++] = a;

            this.mesh[k++] = p.pos[0] + u[0] * p.sz;
            this.mesh[k++] = p.pos[1] + u[1] * p.sz;
            this.mesh[k++] = p.pos[2] + u[2] * p.sz;  
            this.mesh[k++] = 0.0; this.mesh[k++] = 1.0; this.mesh[k++] = a;                
        }
    }
    
    BQ.Particles.prototype.Render = function ()
    {
        var gl = BQ.gl;
               
        gl.uniform4fv(BQ.Shaders["particle"].param["uColor"], this.color);
        
        gl.bindTexture(gl.TEXTURE_2D, BQ.Textures[this.texture].tex);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bufferData(gl.ARRAY_BUFFER, this.mesh, gl.STATIC_DRAW);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
        gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 24, 12);
        
        gl.drawArrays(gl.TRIANGLES, 0, this.active * 6);
    }
}) ();