'use strict';
/*  post.js — Bloom (knee + tinted), kawase blur, grading, anamorphic streak,
    ACES output. Beat-driven lift uses smoothed `S.beatVisual` (see audio.js). */

(function () {
  var gl = NX.gl, S = NX.S, P = NX.P;
  var u = NX.u, bindQuad = NX.bindQuad, shapeDrive = NX.shapeDrive;

  function postAudioWeight() {
    var vd = typeof S._visualDrive === 'number' ? S._visualDrive : 0;
    if (vd < 0) vd = 0;
    if (vd > 1) vd = 1;
    return 0.11 + 0.89 * vd;
  }

  /** Raw beat 0–1+ before calm scaling. */
  function beatForPostRaw() {
    var bv = typeof S.beatVisual === 'number' ? S.beatVisual : Math.min(1, S.beat * 0.55);
    var tr = typeof S.sTransient === 'number' ? S.sTransient : 0;
    return Math.min(1.35, bv * 1.04 + S.sBass * 0.05 + tr * 0.1);
  }

  /** Smoothed beat for post, scaled down when there is no / quiet input. */
  function beatForPost() {
    return beatForPostRaw() * postAudioWeight();
  }

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
    'uniform float BT,T,B,M,H,FL,BM,HS,KA,GL,STK,ACES;',
    'vec3 rgb2hsv(vec3 c){',
    ' vec4 K=vec4(0.,-1./3.,2./3.,-1.);',
    ' vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));',
    ' vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));',
    ' float d=q.x-min(q.w,q.y),e=1.0e-10;',
    ' return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)),d/(q.x+e),q.x);',
    '}',
    'vec3 hsv2rgb(vec3 c){',
    ' vec4 K=vec4(1.,2./3.,1./3.,3.);',
    ' vec3 p=abs(fract(c.xxx+K.xyz)*6.-K.www);',
    ' return c.z*mix(K.xxx,clamp(p-K.xxx,0.,1.),c.y);',
    '}',
    'vec3 ACES(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}',
    'vec2 nxKale(vec2 u,float k){',
    ' if(k<.0005)return u;',
    ' vec2 p=u-.5;',
    ' float sl=max(3.,floor(4.+k*11.));',
    ' float ag=atan(p.y,p.x);',
    ' float a=abs(mod(ag+3.14159/sl,6.28318/sl)-3.14159/sl);',
    ' float rl=length(p);',
    ' return rl*vec2(cos(a),sin(a))+.5;',
    '}',
    'vec2 nxGli(vec2 u,float g,float tim){',
    ' if(g<.0005)return u;',
    ' float row=floor(u.y*130.);',
    ' float f=fract(sin(row*19.123+tim*4.2)*43758.5453);',
    ' float chop=step(.9,f);',
    ' return u+vec2(chop*g*.07*sin(tim*25.+row*1.7),0.);',
    '}',
    'void main(){',
    '  vec2 uvo=nxGli(nxKale(uv,KA),GL,T);',
    '  vec2 px=vec2(1./max(R.x,1.),1./max(R.y,1.));',
    '  float ca=.0024+BT*.0035+B*.0034+H*.0022+FL*.002;',
    '  vec3 cM=texture2D(tex,uvo).rgb;',
    '  float r=texture2D(tex,vec2(uvo.x+ca,uvo.y)).r;',
    '  float g=cM.g;',
    '  float b=texture2D(tex,vec2(uvo.x-ca,uvo.y)).b;',
    '  vec3 col=vec3(r,g,b);',
    /* sharpen */
    '  vec3 up=texture2D(tex,uvo+vec2(0.,px.y)).rgb;',
    '  vec3 dn=texture2D(tex,uvo-vec2(0.,px.y)).rgb;',
    '  vec3 lf=texture2D(tex,uvo-vec2(px.x,0.)).rgb;',
    '  vec3 rt=texture2D(tex,uvo+vec2(px.x,0.)).rgb;',
    '  vec3 lap=cM*4.-up-dn-lf-rt;',
    '  float shp=.1+BT*.07+FL*.1+H*.07;',
    '  col+=lap*shp;',
    /* bloom + anamorphic (BM = master bloom mix, performance toggle) */
    '  vec3 blm=texture2D(bloom,uv).rgb*2.45*(1.+BT*.42+B*.38+M*.15+FL*.18);',
    '  vec3 stk=texture2D(streak,uv).rgb*.4*(1.+BT*.32+B*.22);',
    '  col+=(blm+stk*STK)*BM;',
    /* lift / gamma / gain  — warm shadows, cool highlights */
    '  vec3 lift=vec3(.025,.018,.01);',
    '  vec3 gain=vec3(.97,.98,1.02);',
    '  col=col*gain+lift;',
    /* brightness pump */
    '  col*=1.+B*.32+BT*.48+M*.14+H*.14+FL*.11;',
    /* beat lift — kept subtle (BT is pre-smoothed in JS) */
    '  col+=vec3(1.)*BT*.042*smoothstep(.2,.88,BT);',
    /* S-curve contrast */
    '  col=col*col*(3.-2.*col);',
    /* ACES */
    '  if(ACES>.5) col=ACES(col);',
    /* saturation pump */
    '  float L=dot(col,vec3(.299,.587,.114));',
    '  float satm=1.06+BT*.06+H*.09+M*.06+FL*.07;',
    '  col=mix(vec3(L),col,satm);',
    /* grain */
    '  float grain=fract(sin(dot(uv+T*.13,vec2(12.99,78.23)))*43758.)-0.5;',
    '  col+=grain*(.015+BT*.012+H*.014);',
    /* hue (MIDI / UI color shift) */
    '  vec3 hsv=rgb2hsv(col); hsv.x=fract(hsv.x+HS); col=hsv2rgb(hsv);',
    /* vignette */
    '  vec2 vp=uv*2.-1.;col*=1.-dot(vp,vp)*(.34-BT*.04-B*.05);',
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

  var COPY_FS = [
    'precision mediump float;varying vec2 uv;uniform sampler2D tex;',
    'void main(){gl_FragColor=texture2D(tex,uv);}'
  ].join('');

  var TRAIL_FS = [
    'precision mediump float;varying vec2 uv;',
    'uniform sampler2D cur,prev;uniform float tr;',
    'void main(){',
    ' vec3 c=texture2D(cur,uv).rgb,p=texture2D(prev,uv).rgb;',
    ' gl_FragColor=vec4(min(c+p*tr,vec3(1.)),1.);',
    '}'
  ].join('');

  /* ---- Compile ----------------------------------------------------- */
  var bloomProg, blurProg, streakProg, outProg, blendProg, copyProg, trailProg;
  var fbStreak = null;
  var fbScratch = null, fbTr0 = null, fbTr1 = null;
  var blackTex = null;
  var trailWhich = 0;
  var _auxW = 0, _auxH = 0;

  function compile() {
    bloomProg = NX.mkProg(NX.VS, BLOOM_FS);
    blurProg = NX.mkProg(NX.VS, BLUR_FS);
    streakProg = NX.mkProg(NX.VS, STREAK_FS);
    outProg = NX.mkProg(NX.VS, OUTPUT_FS);
    blendProg = NX.mkProg(NX.VS, BLEND_FS);
    copyProg = NX.mkProg(NX.VS, COPY_FS);
    trailProg = NX.mkProg(NX.VS, TRAIL_FS);
    NX.postProgs = { bloom: bloomProg, blur: blurProg, streak: streakProg, out: outProg, blend: blendProg, copy: copyProg, trail: trailProg };
    console.log('Post: bloom', !!bloomProg, '| out', !!outProg, '| copy', !!copyProg);
    return !!(bloomProg && blurProg && outProg && blendProg && copyProg && trailProg);
  }

  function ensureBlackTex() {
    if (blackTex) return;
    blackTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, blackTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  }

  function releaseAux() {
    function del(rt) {
      if (!rt) return;
      gl.deleteTexture(rt.t); gl.deleteFramebuffer(rt.f);
    }
    del(fbScratch); del(fbTr0); del(fbTr1);
    fbScratch = fbTr0 = fbTr1 = null; _auxW = _auxH = 0;
  }

  function ensureAuxTargets() {
    var w = NX.C.width | 0, h = NX.C.height | 0;
    if (w < 4 || h < 4) return false;
    if (fbScratch && w === _auxW && h === _auxH) return true;
    releaseAux();
    fbScratch = NX.mkRT(w, h); fbTr0 = NX.mkRT(w, h); fbTr1 = NX.mkRT(w, h);
    _auxW = w; _auxH = h;
    trailWhich = 0;
    return true;
  }

  function drawOutputToCurrentFBO(finalTex, bloomSam, streakSam, bm) {
    var pc = S.postChain;
    gl.useProgram(outProg); bindQuad(outProg);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, finalTex); gl.uniform1i(u(outProg, 'tex'), 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, bloomSam); gl.uniform1i(u(outProg, 'bloom'), 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, streakSam); gl.uniform1i(u(outProg, 'streak'), 2);
    var pa = postAudioWeight();
    var bRaw = beatForPostRaw();
    var bPost = bRaw * pa;
    gl.uniform1f(u(outProg, 'BT'), bPost);
    gl.uniform1f(u(outProg, 'T'), S.GT * (0.38 + 0.62 * pa));
    gl.uniform1f(u(outProg, 'B'), (shapeDrive(S.sBass, 1.84) + bRaw * 0.3) * pa);
    gl.uniform1f(u(outProg, 'M'), shapeDrive(S.sMid, 1.72) * pa);
    gl.uniform1f(u(outProg, 'H'), shapeDrive(S.sHigh, 1.78) * pa);
    gl.uniform1f(u(outProg, 'FL'), Math.min(1.2, (S.sFlux * 1.05 + bRaw * 0.14) * pa));
    gl.uniform2f(u(outProg, 'R'), NX.C.width, NX.C.height);
    gl.uniform1f(u(outProg, 'BM'), bm);
    gl.uniform1f(u(outProg, 'HS'), Math.max(-0.5, Math.min(0.5, S.hueShift || 0)));
    var kaBase = S.postFxKaleido == null ? 0 : Math.max(0, Math.min(1, S.postFxKaleido));
    var glBase = S.postFxGlitch == null ? 0 : Math.max(0, Math.min(1, S.postFxGlitch));
    if (S.nexusVizPerformance) { kaBase *= 0.45; glBase *= 0.55; }
    if (pc && pc.kaleido === false) kaBase = 0;
    if (pc && pc.glitch === false) glBase = 0;
    var trn = typeof S.sTransient === 'number' ? S.sTransient : 0;
    var glEff = Math.min(1, glBase + trn * 0.42 * (0.55 + 0.45 * (S.bpmConfidence || 0)));
    if (pc && pc.glitch === false) glEff = trn * 0.08;
    gl.uniform1f(u(outProg, 'KA'), kaBase);
    gl.uniform1f(u(outProg, 'GL'), glEff);
    var streakOn = !pc || pc.streak !== false ? 1 : 0;
    var acesOn = !pc || pc.grade !== false ? 1 : 0;
    gl.uniform1f(u(outProg, 'STK'), streakOn);
    gl.uniform1f(u(outProg, 'ACES'), acesOn);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /* ---- Render post chain ------------------------------------------- */
  function render(finalTex, fbBloom, fbBloomBlur, hw, hh) {
    ensureBlackTex();
    var pc0 = S.postChain;
    var bloomOn = !!S.nexusPostBloom && (!pc0 || pc0.bloom !== false);
    var paBloom = postAudioWeight();
    var bm = bloomOn ? Math.max(0, Math.min(2.2, (S.postBloomMul == null ? 1 : S.postBloomMul) * (0.42 + 0.58 * paBloom))) : 0;
    var bloomSam = blackTex;
    var streakSam = blackTex;

    if (bloomOn) {
      if (!fbStreak) fbStreak = NX.mkRT(hw, hh);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbBloom.f); gl.viewport(0, 0, hw, hh);
      gl.useProgram(bloomProg); bindQuad(bloomProg);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, finalTex); gl.uniform1i(u(bloomProg, 'tex'), 0);
      var paB = postAudioWeight();
      var bR = beatForPostRaw();
      var bBl = bR * paB;
      gl.uniform1f(u(bloomProg, 'thresh'), Math.max(0.26, 0.41 - bBl * 0.14 - Math.min(0.2, S.sBass * 0.28 * paB) - Math.min(0.09, S.sHigh * 0.06 * paB) - S.sFlux * 0.07 * paB));
      gl.uniform1f(u(bloomProg, 'BT'), bBl);
      gl.uniform1f(u(bloomProg, 'B'), (shapeDrive(S.sBass, 1.84) + bR * 0.3) * paB);
      gl.uniform1f(u(bloomProg, 'H'), shapeDrive(S.sHigh, 1.78) * paB);
      gl.uniform1f(u(bloomProg, 'FL'), Math.min(1.2, S.sFlux * 1.12 * paB));
      gl.uniform1f(u(bloomProg, 'M'), shapeDrive(S.sMid, 1.72) * paB);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      gl.bindFramebuffer(gl.FRAMEBUFFER, fbBloomBlur.f);
      gl.useProgram(blurProg); bindQuad(blurProg);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fbBloom.t); gl.uniform1i(u(blurProg, 'tex'), 0);
      gl.uniform2f(u(blurProg, 'dir'), 1.8 / hw, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      gl.bindFramebuffer(gl.FRAMEBUFFER, fbBloom.f);
      gl.useProgram(blurProg); bindQuad(blurProg);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fbBloomBlur.t); gl.uniform1i(u(blurProg, 'tex'), 0);
      gl.uniform2f(u(blurProg, 'dir'), 0, 1.8 / hh);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      if (streakProg) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbStreak.f); gl.viewport(0, 0, hw, hh);
        gl.useProgram(streakProg); bindQuad(streakProg);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fbBloom.t); gl.uniform1i(u(streakProg, 'tex'), 0);
        gl.uniform1f(u(streakProg, 'str'), 0.004);
        var paS = postAudioWeight();
        gl.uniform1f(u(streakProg, 'BT'), beatForPostRaw() * paS);
        gl.uniform1f(u(streakProg, 'B'), shapeDrive(S.sBass, 1.84) * paS);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      bloomSam = fbBloom.t;
      streakSam = (streakProg && fbStreak) ? fbStreak.t : fbBloom.t;
    }

    if (!ensureAuxTargets()) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, NX.C.width, NX.C.height);
      drawOutputToCurrentFBO(finalTex, bloomSam, streakSam, bm);
      return;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbScratch.f); gl.viewport(0, 0, _auxW, _auxH);
    drawOutputToCurrentFBO(finalTex, bloomSam, streakSam, bm);

    var trBase = S.nexusPostTrails == null ? 0 : Math.max(0, Math.min(1, S.nexusPostTrails));
    var tr = (!pc0 || pc0.trails !== false) ? trBase : 0;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, _auxW, _auxH);

    if (tr > 0.004 && trailProg) {
      var prevRT = trailWhich === 0 ? fbTr0 : fbTr1;
      var nextRT = trailWhich === 0 ? fbTr1 : fbTr0;
      gl.bindFramebuffer(gl.FRAMEBUFFER, nextRT.f); gl.viewport(0, 0, _auxW, _auxH);
      gl.useProgram(trailProg); bindQuad(trailProg);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fbScratch.t); gl.uniform1i(u(trailProg, 'cur'), 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, prevRT.t); gl.uniform1i(u(trailProg, 'prev'), 1);
      gl.uniform1f(u(trailProg, 'tr'), tr * 0.88);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, _auxW, _auxH);
      gl.useProgram(copyProg); bindQuad(copyProg);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, nextRT.t); gl.uniform1i(u(copyProg, 'tex'), 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      trailWhich = 1 - trailWhich;
    } else {
      gl.useProgram(copyProg); bindQuad(copyProg);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fbScratch.t); gl.uniform1i(u(copyProg, 'tex'), 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  NX.post = { compile: compile, render: render };
})();
