'use strict';
/**
 * homage-gl-scenes.js — GLSL-only homage moods (original shaders; see Credits in index).
 * Plan refs: MITD, Way to Go, Yes No If, Chris Raff maze, Vidovic cyber grid, Terminal 00 / Irentaex rhythm.
 */
(function () {
  var H = NX.HEAD;

  NX.registerScene({
    n: 'MITD VOID TRACE', rx: 0, c: '#030305', tags: ['calm'], cost: 'low',
    fs: H + [
      'void main(){',
      ' vec2 p=uv;',
      ' vec3 c=vec3(.008,.008,.012);',
      ' float d=length(p-MX);',
      ' float glow=exp(-d*d*9500.)*(.55+V*.25);',
      ' c+=vec3(.85,.88,.95)*glow;',
      ' gl_FragColor=vec4(sat(c),1.);',
      '}'
    ].join('\n')
  });

  NX.registerScene({
    n: 'AWAY WOODLAND DRIFT', rx: 1, c: '#1b3d2d', tags: ['calm'], cost: 'low',
    fs: H + [
      'void main(){',
      ' vec2 p=(uv-.5)*vec2(R.x/R.y,1.);',
      ' float scroll=T*SP*.08+B*.02;',
      ' float trees=0.;',
      ' for(float x=-4.;x<4.;x+=1.){',
      '  float px=x*.28+scroll;',
      '  float tr=abs(p.x-px);',
      '  trees+=smoothstep(.035,.0,tr)*smoothstep(-.25,.35,p.y)*(.15+M*.08);',
      ' }',
      ' vec3 sky=mix(vec3(.15,.22,.35),vec3(.4,.55,.75),uv.y);',
      ' vec3 c=sky*(.2+uv.y*.8)+vec3(.05,.18,.08)*trees;',
      ' c+=vec3(.9,.95,.75)*exp(-distance(uv,MX)*28.)*.07;',
      ' gl_FragColor=vec4(sat(c),1.);',
      '}'
    ].join('\n')
  });

  NX.registerScene({
    n: 'YNI DECISION FIELD', rx: 1, c: '#ff1744', tags: ['calm'], cost: 'low',
    fs: H + [
      'void main(){',
      ' float st=mod(floor(HM.x+.001),3.);',
      ' vec3 c0=vec3(.9,.15,.2); vec3 c1=vec3(.15,.25,.9); vec3 c2=vec3(.2,.75,.25);',
      ' vec3 c=st<.5?c0:(st<1.5?c1:c2);',
      ' float v=smoothstep(.45,.55,abs(uv.x-.5));',
      ' c=mix(c,vec3(.05),v*.35);',
      ' c+=vec3(.08)*sin(uv.y*30.+T);',
      ' gl_FragColor=vec4(sat(c),1.);',
      '}'
    ].join('\n')
  });

  NX.registerScene({
    n: 'MAZE COMPASS HUD', rx: 1, c: '#263238', tags: ['intense'], cost: 'med',
    fs: H + [
      'void main(){',
      ' vec2 p=(uv-.5)*vec2(R.x/R.y,1.);',
      ' vec2 cell=floor(p*8.+vec2(.5));',
      ' float m=mod(cell.x+cell.y*3.,5.);',
      ' float wall=step(.15,fract(p.x*8.+.5))*step(.15,fract(p.y*8.+.5));',
      ' wall=1.-wall; float maze=step(.3,m);',
      ' vec3 c=vec3(.04,.05,.07)+vec3(.12,.14,.18)*maze*wall;',
      ' vec2 exit=vec2(.35,.25); float comp=atan(exit.y-p.y,exit.x-p.x);',
      ' float needle=smoothstep(.08,.02,abs(atan(p.y,p.x)-comp-.2));',
      ' c+=vec3(.2,.9,.5)*needle*.25;',
      ' gl_FragColor=vec4(sat(c),1.);',
      '}'
    ].join('\n')
  });

  NX.registerScene({
    n: 'CYBR MAINFRAME GRID', rx: 2, c: '#00ff41', tags: ['intense'], cost: 'med',
    fs: H + [
      'void main(){',
      ' vec2 p=(uv-.5)*vec2(R.x/R.y,1.);',
      ' float z=1./(abs(p.y)+.25);',
      ' vec2 q=p*z;',
      ' float g=abs(fract(q*8.)-.5);',
      ' float line=smoothstep(.04,.02,min(g.x,g.y));',
      ' vec3 c=vec3(0.,.02+line*.25,0.)+vec3(.1,.9,.3)*line*.35;',
      ' c+=vec3(.5,1.,.6)*exp(-length(p-vec2(sin(T*SP*.2)*.3,.1))*6.)*(.1+B*.15);',
      ' gl_FragColor=vec4(sat(c),1.);',
      '}'
    ].join('\n')
  });

  NX.registerScene({
    n: 'T00 PROBE VEIL', rx: 1, c: '#1a1a2e', tags: ['calm'], cost: 'low',
    fs: H + [
      'void main(){',
      ' vec2 p=uv;',
      ' float n=fbm(p*6.+T*.05);',
      ' float mask=smoothstep(.22,.18,length(p-MX));',
      ' vec3 c=vec3(.03)*n;',
      ' c+=vec3(.75,.78,.95)*mask*(.25+texture2D(AU,vec2(uv.x,.2)).r*.2);',
      ' gl_FragColor=vec4(sat(c),1.);',
      '}'
    ].join('\n')
  });

  NX.registerScene({
    n: 'T00 REFUSAL STREAM', rx: 1, c: '#0d0221', tags: ['calm'], cost: 'low',
    fs: H + [
      'void main(){',
      ' float band=floor(uv.y*9.+mod(T*SP*.4,12.));',
      ' float rep=mod(band,4.);',
      ' vec3 c=vec3(.04,.03,.08)+pal(rep*.07+uv.x*.1)*.12;',
      ' float w=sin(uv.y*80.+T*2.+rep)*.5+.5;',
      ' c+=vec3(.6,.55,.9)*w*.04*(.5+BC);',
      ' gl_FragColor=vec4(sat(c),1.);',
      '}'
    ].join('\n')
  });

  NX.registerScene({
    n: 'MITD BREATH BLACK', rx: 0, c: '#020203', tags: ['calm'], cost: 'low',
    fs: H + [
      'void main(){',
      ' vec2 p=uv;',
      ' vec3 c=vec3(.006,.006,.01);',
      ' float br=sat(HM.y);',
      ' float d=length(p-MX);',
      ' float g=exp(-d*d*(7200.-4200.*br))*(.5+br*.45);',
      ' c+=vec3(.82,.86,.95)*g;',
      ' gl_FragColor=vec4(sat(c),1.);',
      '}'
    ].join('\n')
  });

  NX.registerScene({
    n: 'MITD DISTANT PULSE', rx: 0, c: '#04040a', tags: ['calm'], cost: 'low',
    fs: H + [
      'void main(){',
      ' vec2 p=uv;',
      ' vec3 c=vec3(.007,.007,.012);',
      ' float ph=sat(HM.z);',
      ' float d=length(p-MX);',
      ' vec3 tint=vec3(.75,.8,.95)+vec3(.15,.08,.12)*sin(ph*6.28318);',
      ' float glow=exp(-d*d*9000.)*.5;',
      ' c+=tint*glow;',
      ' gl_FragColor=vec4(sat(c),1.);',
      '}'
    ].join('\n')
  });

  NX.registerScene({
    n: 'AWAY RUN SKY', rx: 1, c: '#153d28', tags: ['intense'], cost: 'med',
    fs: H + [
      'void main(){',
      ' vec2 p=(uv-.5)*vec2(R.x/R.y,1.);',
      ' float hop=.06*sin(T*SP*1.8+B*2.);',
      ' float scroll=T*SP*.22+B*.04;',
      ' float trees=0.;',
      ' for(float x=-5.;x<5.;x+=1.){',
      '  float px=x*.24+scroll;',
      '  float tr=abs(p.x-px);',
      '  trees+=smoothstep(.03,.0,tr)*smoothstep(-.3+hop,.4+hop,p.y)*(.18+M*.1);',
      ' }',
      ' vec3 sky=mix(vec3(.1,.18,.32),vec3(.55,.72,.9),sat(uv.y+.1));',
      ' vec3 c=sky*(.25+uv.y*.75)+vec3(.04,.16,.09)*trees;',
      ' c+=vec3(.95,.98,.8)*exp(-distance(uv,MX)*22.)*.09;',
      ' gl_FragColor=vec4(sat(c),1.);',
      '}'
    ].join('\n')
  });

  NX.registerScene({
    n: 'AWAY SHADOW METRO', rx: 1, c: '#14261c', tags: ['calm'], cost: 'low',
    fs: H + [
      'void main(){',
      ' vec2 p=(uv-.5)*vec2(R.x/R.y,1.);',
      ' float scroll=T*SP*.09;',
      ' float trees=0.;',
      ' for(float x=-4.;x<4.;x+=1.){',
      '  float px=x*.28+scroll;',
      '  trees+=smoothstep(.035,.0,abs(p.x-px))*smoothstep(-.25,.35,p.y)*.14;',
      ' }',
      ' vec3 sky=mix(vec3(.12,.2,.32),vec3(.45,.58,.75),uv.y);',
      ' vec3 c=sky*(.2+uv.y*.8)+vec3(.05,.16,.08)*trees;',
      ' vec2 sh=MX+vec2(PH*.04-.02,PH*-.03);',
      ' c+=vec3(.06,.08,.06)*exp(-distance(uv,sh)*35.)*.25;',
      ' c+=vec3(.85,.9,.75)*exp(-distance(uv,MX)*26.)*.06;',
      ' gl_FragColor=vec4(sat(c),1.);',
      '}'
    ].join('\n')
  });

  NX.registerScene({
    n: 'YNI BEAT COURT', rx: 1, c: '#c51162', tags: ['intense'], cost: 'low',
    fs: H + [
      'void main(){',
      ' float st=BC>.12?mod(floor(PH*3.+BP*2.),3.):mod(floor(HM.x+.001),3.);',
      ' vec3 c0=vec3(.92,.12,.18); vec3 c1=vec3(.12,.22,.92); vec3 c2=vec3(.18,.78,.22);',
      ' vec3 c=st<.5?c0:(st<1.5?c1:c2);',
      ' c=mix(vec3(.04),c,.92);',
      ' c+=vec3(.1)*sin(uv.y*40.+T*3.);',
      ' gl_FragColor=vec4(sat(c),1.);',
      '}'
    ].join('\n')
  });

  NX.registerScene({
    n: 'YNI CREST SWITCH', rx: 1, c: '#aa00ff', tags: ['intense'], cost: 'low',
    fs: H + [
      'void main(){',
      ' float st=floor(sat(V)*2.99);',
      ' vec3 c0=vec3(.85,.2,.35); vec3 c1=vec3(.2,.45,.9); vec3 c2=vec3(.25,.85,.45);',
      ' vec3 c=st<.5?c0:(st<1.5?c1:c2);',
      ' float band=sin(uv.y*60.+V*10.);',
      ' c*=(.75+band*.08);',
      ' gl_FragColor=vec4(sat(c),1.);',
      '}'
    ].join('\n')
  });

  NX.registerScene({
    n: 'MAZE PULSE LAB', rx: 1, c: '#1c2833', tags: ['intense'], cost: 'med',
    fs: H + [
      'void main(){',
      ' vec2 p=(uv-.5)*vec2(R.x/R.y,1.);',
      ' vec2 cell=floor(p*8.+vec2(.5));',
      ' float m=mod(cell.x+cell.y*3.,5.);',
      ' float wall=1.-step(.15,fract(p.x*8.+.5))*step(.15,fract(p.y*8.+.5));',
      ' float maze=step(.3,m);',
      ' vec3 base=vec3(.04,.06,.08)+vec3(.15,.2,.25)*maze*wall;',
      ' base+=vec3(.3,.9,.5)*B*.15*maze;',
      ' gl_FragColor=vec4(sat(base),1.);',
      '}'
    ].join('\n')
  });

  NX.registerScene({
    n: 'MAZE GALLERY RIG', rx: 0, c: '#212121', tags: ['calm'], cost: 'low',
    fs: H + [
      'void main(){',
      ' vec2 p=(uv-.5)*1.15;',
      ' vec2 cell=floor(p*10.+.5);',
      ' float m=mod(cell.x*2.+cell.y,7.);',
      ' float wall=step(.12,fract(p.x*10.))*(1.-step(.88,fract(p.x*10.)));',
      ' wall*=step(.12,fract(p.y*10.))*(1.-step(.88,fract(p.y*10.)));',
      ' vec3 c=vec3(.05)+vec3(.12,.14,.16)*wall*step(1.5,m);',
      ' c+=vec3(.25,.8,.4)*exp(-length(p)*.35)*.08;',
      ' gl_FragColor=vec4(sat(c),1.);',
      '}'
    ].join('\n')
  });

  NX.registerScene({
    n: 'CYBR COMPRESS STACK', rx: 2, c: '#00e676', tags: ['intense'], cost: 'high',
    fs: H + [
      'void main(){',
      ' vec2 p=(uv-.5)*vec2(R.x/R.y,1.);',
      ' float z=1./(abs(p.y)+.18+B*.08);',
      ' vec2 q=p*z;',
      ' float den=8.+B*10.;',
      ' float g=abs(fract(q*den)-.5);',
      ' float line=smoothstep(.035,.015,min(g.x,g.y));',
      ' vec3 c=vec3(0.,.03,0.)+vec3(.15,1.,.4)*line*(.35+BT*.2);',
      ' gl_FragColor=vec4(sat(c),1.);',
      '}'
    ].join('\n')
  });

  NX.registerScene({
    n: 'CYBR TRACE RAIL', rx: 2, c: '#00c853', tags: ['intense'], cost: 'med',
    fs: H + [
      'void main(){',
      ' vec2 p=uv;',
      ' float scan=sin(p.y*R.y*.12+T*SP*3.);',
      ' vec3 c=vec3(.01,.04,.02);',
      ' float h=step(.97,fract(p.x*3.+T*.5));',
      ' c+=vec3(.2,1.,.45)*(h*.25+scan*.04);',
      ' c+=vec3(.4,.9,.3)*exp(-abs(p.y-.5-MX.y*.6)*8.)*.15;',
      ' gl_FragColor=vec4(sat(c),1.);',
      '}'
    ].join('\n')
  });

  NX.registerScene({
    n: 'T00 DEAD CYCLE', rx: 1, c: '#0a0514', tags: ['calm'], cost: 'low',
    fs: H + [
      'void main(){',
      ' vec2 c2=(uv-.5);',
      ' float r=length(c2)+1e-4;',
      ' float rings=sin(r*50.-T*SP*.8)*.5+.5;',
      ' vec3 c=vec3(.03,.02,.06)+pal(rings)*rings*.08;',
      ' c+=vec3(.5,.45,.7)*smoothstep(.02,.0,abs(r-.25))*smoothstep(.02,.0,abs(r-.42));',
      ' gl_FragColor=vec4(sat(c),1.);',
      '}'
    ].join('\n')
  });

  NX.registerScene({
    n: 'T00 GATE CORRUPT', rx: 2, c: '#12061f', tags: ['intense'], cost: 'med',
    fs: H + [
      'void main(){',
      ' vec2 p=uv+vec2(sin(uv.y*30.+FL*8.)*.01,sin(uv.x*28.+BT*10.)*.01);',
      ' float k=sin(p.x*40.)*cos(p.y*40.+T);',
      ' vec3 c=vec3(.04,.02,.08)+pal(k+M)*.15;',
      ' float g=abs(fract(atan(p.y-.5,p.x-.5+1e-4)*3.14159)-.5);',
      ' c+=vec3(.7,.5,.95)*smoothstep(.08,.02,g)*.12;',
      ' gl_FragColor=vec4(sat(c),1.);',
      '}'
    ].join('\n')
  });
})();
