'use strict';
/*  post.js — Bloom (knee + tinted), kawase blur, Hollywood color grading,
    anamorphic streak, ACES output, beat flash.                            */

(function () {
  var gl = NX.gl, S = NX.S, P = NX.P;
  var u = NX.u, bindQuad = NX.bindQuad, shapeDrive = NX.shapeDrive;

  var SAT = '#define sat(x) clamp(x,0.,1.)\n';

  /* ---- Bloom threshold (knee, tinted) ------------------------------ */
  var BLOOM_FS = SAT + [
    'precision mediump float;varying vec2 uv;',
    'uniform sampler2D tex;uniform float thresh,BT,B,H,FL,M;',
    'void main(){',
    '  vec3 c=texture2D(tex,uv).rgb;',
    '  float l=dot(c,vec3(.299,.587,.114));',
    '  float tk=max(.17,thresh-BT*.05-FL*.06);',
    '  float k=smoothstep(tk-.08,tk+.24,l);',
    '  vec3 cool=vec3(.9,.96,1.06),warm=vec3(1.05,.97,.91);',
    '  vec3 tint=mix(cool,warm,sat(B*.75+BT*.55));',
    '  tint*=vec3(1.+H*.08,1.+M*.05,1.+BT*.07);',
    '  gl_FragColor=vec4(c*k*tint,1.);',
    '}'
  ].join('\n');

  /* ---- Gaussian blur (7-tap) --------------------------------------- */
  var BLUR_FS = [
    'precision mediump float;varying vec2 uv;uniform sampler2D tex;uniform vec2 dir;',
    'void main(){',
    '  vec3 c=vec3(0.);',
    '  float w[7];w[0]=.0625;w[1]=.125;w[2]=.1875;w[3]=.25;w[4]=.1875;w[5]=.125;w[6]=.0625;',
    '  for(int i=0;i<7;i++)c+=w[i]*texture2D(tex,uv+dir*float(i-3)).rgb;',
    '  gl_FragColor=vec4(c,1.);',
    '}'
  ].join('\n');

  /* ---- Anamorphic streak (horizontal smear on bright pixels) ------- */
  var STREAK_FS = [
    'precision mediump float;varying vec2 uv;uniform sampler2D tex;uniform float str,BT,B;',
    'void main(){',
    '  vec3 c=vec3(0.);float tw=0.;',
    '  float spread=str*(1.+BT*.5+B*.3);',
    '  for(int i=-8;i<=8;i++){',
    '    float fi=float(i);',
    '    float w=exp(-fi*fi/(2.*4.*4.));',
    '    c+=texture2D(tex,uv+vec2(fi*spread,0.)).rgb*w;',
    '    tw+=w;',
    '  }',
    '  gl_FragColor=vec4(c/tw,1.);',
    '}'
  ].join('\n');

  /* ---- Final output: sharpen + grade + ACES + CA + flash ----------- */
  var OUTPUT_FS = [
    'precision mediump float;varying vec2 uv;',
    'uniform sampler2D tex,bloom,streak;uniform vec2 R;',
    'uniform float BT,T,B,M,H,FL;',
    'vec3 ACES(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}',
    'void main(){',
    '  vec2 px=vec2(1./max(R.x,1.),1./max(R.y,1.));',
    '  float ca=.0026+BT*.007+B*.0038+H*.0024+FL*.0022;',
    '  vec3 cM=texture2D(tex,uv).rgb;',
    '  float r=texture2D(tex,vec2(uv.x+ca,uv.y)).r;',
    '  float g=cM.g;',
    '  float b=texture2D(tex,vec2(uv.x-ca,uv.y)).b;',
    '  vec3 col=vec3(r,g,b);',
    /* sharpen */
    '  vec3 up=texture2D(tex,uv+vec2(0.,px.y)).rgb;',
    '  vec3 dn=texture2D(tex,uv-vec2(0.,px.y)).rgb;',
    '  vec3 lf=texture2D(tex,uv-vec2(px.x,0.)).rgb;',
    '  vec3 rt=texture2D(tex,uv+vec2(px.x,0.)).rgb;',
    '  vec3 lap=cM*4.-up-dn-lf-rt;',
    '  float shp=.11+BT*.14+FL*.12+H*.08;',
    '  col+=lap*shp;',
    /* bloom + anamorphic */
    '  vec3 blm=texture2D(bloom,uv).rgb*2.62*(1.+BT*1.1+B*.44+M*.17+FL*.22);',
    '  vec3 stk=texture2D(streak,uv).rgb*.45*(1.+BT*.6+B*.25);',
    '  col+=blm+stk;',
    /* lift / gamma / gain  — warm shadows, cool highlights */
    '  vec3 lift=vec3(.025,.018,.01);',
    '  vec3 gain=vec3(.97,.98,1.02);',
    '  col=col*gain+lift;',
    /* brightness pump */
    '  col*=1.+B*.38+BT*1.15+M*.16+H*.16+FL*.14;',
    /* beat flash */
    '  col+=vec3(1.)*BT*.18*smoothstep(.6,1.2,BT);',
    /* S-curve contrast */
    '  col=col*col*(3.-2.*col);',
    /* ACES */
    '  col=ACES(col);',
    /* saturation pump */
    '  float L=dot(col,vec3(.299,.587,.114));',
    '  float satm=1.08+BT*.14+H*.11+M*.07+FL*.09;',
    '  col=mix(vec3(L),col,satm);',
    /* grain */
    '  float grain=fract(sin(dot(uv+T*.13,vec2(12.99,78.23)))*43758.)-0.5;',
    '  col+=grain*(.017+BT*.021+H*.015);',
    /* vignette */
    '  vec2 vp=uv*2.-1.;col*=1.-dot(vp,vp)*(.34-BT*.09-B*.05);',
    '  gl_FragColor=vec4(clamp(col,0.,1.),1.);',
    '}'
  ].join('\n');

  /* ---- Blend (scene morph) ----------------------------------------- */
  var BLEND_FS = [
    'precision mediump float;varying vec2 uv;uniform sampler2D A,B2;uniform float mix2;',
    'void main(){',
    '  float t=mix2*mix2*mix2*(mix2*(mix2*6.-15.)+10.);',
    '  vec3 a=texture2D(A,uv).rgb,b=texture2D(B2,uv).rgb;',
    '  float lum=dot(b,vec3(.299,.587,.114));',
    '  float glow=smoothstep(.35,.95,lum)*0.08;',
    '  gl_FragColor=vec4(mix(a,b,t)+glow*t*(1.-t),1.);',
    '}'
  ].join('');

  /* ---- Compile ----------------------------------------------------- */
  var bloomProg, blurProg, streakProg, outProg, blendProg;
  var fbStreak = null;

  function compile() {
    bloomProg = NX.mkProg(NX.VS, BLOOM_FS);
    blurProg = NX.mkProg(NX.VS, BLUR_FS);
    streakProg = NX.mkProg(NX.VS, STREAK_FS);
    outProg = NX.mkProg(NX.VS, OUTPUT_FS);
    blendProg = NX.mkProg(NX.VS, BLEND_FS);
    NX.postProgs = { bloom: bloomProg, blur: blurProg, streak: streakProg, out: outProg, blend: blendProg };
    console.log('Post: bloom', !!bloomProg, '| blur', !!blurProg, '| streak', !!streakProg, '| out', !!outProg);
    return !!(bloomProg && blurProg && outProg && blendProg);
  }

  /* ---- Render post chain ------------------------------------------- */
  function render(finalTex, fbBloom, fbBloomBlur, hw, hh) {
    if (!fbStreak) fbStreak = NX.mkRT(hw, hh);

    /* bloom threshold */
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbBloom.f); gl.viewport(0, 0, hw, hh);
    gl.useProgram(bloomProg); bindQuad(bloomProg);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, finalTex); gl.uniform1i(u(bloomProg, 'tex'), 0);
    gl.uniform1f(u(bloomProg, 'thresh'), Math.max(0.23, 0.43 - S.beat * 0.29 - Math.min(0.22, S.sBass * 0.31) - Math.min(0.1, S.sHigh * 0.07) - S.sFlux * 0.08));
    gl.uniform1f(u(bloomProg, 'BT'), Math.min(1.48, S.beat * 1.24));
    gl.uniform1f(u(bloomProg, 'B'), shapeDrive(S.sBass, 1.84) + S.beat * 0.48);
    gl.uniform1f(u(bloomProg, 'H'), shapeDrive(S.sHigh, 1.78));
    gl.uniform1f(u(bloomProg, 'FL'), Math.min(1.2, S.sFlux * 1.12));
    gl.uniform1f(u(bloomProg, 'M'), shapeDrive(S.sMid, 1.72));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    /* blur X */
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbBloomBlur.f);
    gl.useProgram(blurProg); bindQuad(blurProg);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fbBloom.t); gl.uniform1i(u(blurProg, 'tex'), 0);
    gl.uniform2f(u(blurProg, 'dir'), 1.8 / hw, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    /* blur Y */
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbBloom.f);
    gl.useProgram(blurProg); bindQuad(blurProg);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fbBloomBlur.t); gl.uniform1i(u(blurProg, 'tex'), 0);
    gl.uniform2f(u(blurProg, 'dir'), 0, 1.8 / hh);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    /* anamorphic streak */
    if (streakProg) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbStreak.f); gl.viewport(0, 0, hw, hh);
      gl.useProgram(streakProg); bindQuad(streakProg);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fbBloom.t); gl.uniform1i(u(streakProg, 'tex'), 0);
      gl.uniform1f(u(streakProg, 'str'), 0.004);
      gl.uniform1f(u(streakProg, 'BT'), Math.min(1.48, S.beat * 1.24));
      gl.uniform1f(u(streakProg, 'B'), shapeDrive(S.sBass, 1.84));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    /* final output */
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, NX.C.width, NX.C.height);
    gl.useProgram(outProg); bindQuad(outProg);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, finalTex); gl.uniform1i(u(outProg, 'tex'), 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, fbBloom.t); gl.uniform1i(u(outProg, 'bloom'), 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, fbStreak ? fbStreak.t : fbBloom.t); gl.uniform1i(u(outProg, 'streak'), 2);
    gl.uniform1f(u(outProg, 'BT'), Math.min(1.48, S.beat * 1.24));
    gl.uniform1f(u(outProg, 'T'), S.GT);
    gl.uniform1f(u(outProg, 'B'), shapeDrive(S.sBass, 1.84) + S.beat * 0.48);
    gl.uniform1f(u(outProg, 'M'), shapeDrive(S.sMid, 1.72));
    gl.uniform1f(u(outProg, 'H'), shapeDrive(S.sHigh, 1.78));
    gl.uniform1f(u(outProg, 'FL'), Math.min(1.25, S.sFlux * 1.08 + S.beat * 0.22));
    gl.uniform2f(u(outProg, 'R'), NX.C.width, NX.C.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  NX.post = { compile: compile, render: render };
})();
