'use strict';
/*  nexus-pro-suite-scenes.js — Pro 2026 scene pack: audio science, rendering, workflow motifs.
    Uses shared `PRO` uniform from nexus-pro-audio-science.js + engine setCommonUniforms. */

(function () {
  var H = NX.HEAD;

  NX.registerScene({
    n: 'CHROMA TONNETZ WEB', c: '#b388ff',
    tags: ['pro', 'science', 'sacred'],
    cost: 'med',
    rx: 1,
    fs: H + [
      'void main(){',
      '  vec2 p=(uv-.5)*2.2;',
      '  float a=PRO.x*TAU;',
      '  mat2 rm=mat2(cos(a),-sin(a),sin(a),cos(a));',
      '  p=rm*p;',
      '  float q=1.7320508;',
      '  vec2 h=vec2(1.,0.),v=vec2(.5,.8660254);',
      '  vec2 g=p;',
      '  float c=0.;',
      '  for(int i=0;i<3;i++){',
      '    vec2 id=floor(vec2(dot(g,h),dot(g,v)));',
      '    vec2 lc=g-id.x*h-id.y*v;',
      '    float d=min(min(abs(lc.x),abs(lc.y)),abs(lc.x+lc.y*q*.57735));',
      '    c+=exp(-d*28.)*(.35+PRO.w*.45);',
      '    g*=1.62; g+=vec2(sin(T*.12+float(i)),cos(T*.09))*M*.04;',
      '  }',
      '  float e=B*.25+M*.18+H*.12+BT*.22;',
      '  vec3 col=pal(PRO.x+.2*c+e)*(.25+c*(.55+FL*.25));',
      '  vec2 fuv=feedUV(1.002,PRO.w*.04,vec2(0));',
      '  col=mix(texture2D(PV,fuv).rgb*.82,col,.38+BT*.06);',
      '  gl_FragColor=vec4(col,1.);',
      '}'
    ].join('\n')
  });

  NX.registerScene({
    n: 'STEREO M/S PHASE RIBBON', c: '#4fc3f7',
    tags: ['pro', 'science'],
    cost: 'med',
    rx: 1,
    fs: H + [
      'void main(){',
      '  vec2 p=(uv-.5)*2.;',
      '  float ph=PRO.z*TAU;',
      '  float y=p.y;',
      '  float ribbon=0.;',
      '  for(int s=0;s<96;s++){',
      '    float u=float(s)/95.;',
      '    float sm=texture2D(AU,vec2(fract(u+T*.03),.25)).r;',
      '    float sw=texture2D(AU,vec2(fract(u+PH*.25),.75)).r;',
      '    vec2 pos=vec2((sm-.5)*1.8,(sw-.5)*1.6);',
      '    pos.x+=sin(u*TAU*2.+T*.4+ph)*PRO.y*.35;',
      '    float d=length(p-pos)-(.012+BT*.01);',
      '    ribbon+=exp(-d*d*420.)*(.35+M*.25);',
      '  }',
      '  vec3 col=mix(vec3(.02,.05,.08),vec3(.2,.85,.95),ribbon);',
      '  col+=vec3(1.,.75,.35)*PRO.w*.18;',
      '  vec2 fuv=feedUV(1.003,0.,vec2(0));',
      '  col=mix(texture2D(PV,fuv).rgb*.86,col,.42);',
      '  gl_FragColor=vec4(col,1.);',
      '}'
    ].join('\n')
  });

  NX.registerScene({
    n: 'STRUCTURAL CLASSIFIER', c: '#69f0ae',
    tags: ['pro', 'science'],
    cost: 'low',
    rx: 1,
    fs: H + [
      'void main(){',
      '  vec2 p=uv*12.;',
      '  float cell=PRO.w;',
      '  float g1=fbm(p+T*.08);',
      '  float g2=fbm(p*1.9-vec2(T*.11,3.1));',
      '  float m=mix(g1,g2,cell);',
      '  float band=smoothstep(.42,.58,fract(m+BT*.35));',
      '  vec3 cA=pal(.15+PRO.x*.4);',
      '  vec3 cB=pal(.55+cell*.3);',
      '  vec3 col=mix(cA,cB,band);',
      '  col+=vec3(.15,.35,.9)*V*.25;',
      '  vec2 fuv=feedUV(1.001,0.,vec2(0));',
      '  col=mix(texture2D(PV,fuv).rgb*.9,col,.32+BT*.05);',
      '  gl_FragColor=vec4(col,1.);',
      '}'
    ].join('\n')
  });

  NX.registerScene({
    n: 'VECTORSCOPE DEPTH', c: '#ff9100',
    tags: ['pro', 'science'],
    cost: 'high',
    rx: 2,
    fs: H + [
      'void main(){',
      '  vec2 p=(uv-.5)*2.1;',
      '  float acc=0.;',
      '  vec3 col=vec3(.01,.012,.02);',
      '  for(int i=0;i<180;i++){',
      '    float t=float(i)/180.;',
      '    float l=(texture2D(AU,vec2(fract(t+T*.02),.25)).r-.5)*1.9;',
      '    float r=(texture2D(AU,vec2(fract(t*1.03+PH*.2),.75)).r-.5)*1.9;',
      '    float z=sin(t*TAU*2.+T*.35)*.35*(.25+PRO.y);',
      '    vec3 q=vec3(l,r,z);',
      '    float d=length(p-q.xy)-(.014+FL*.008);',
      '    acc+=exp(-d*d*900.)*(.22+BT*.35);',
      '    col+=pal(t+PRO.x)*exp(-d*d*520.)*.08;',
      '  }',
      '  col+=vec3(.9,.75,.35)*acc;',
      '  vec2 fuv=feedUV(1.002,0.,vec2(0));',
      '  col=mix(texture2D(PV,fuv).rgb*.84,col,.4);',
      '  gl_FragColor=vec4(col,1.);',
      '}'
    ].join('\n')
  });

  NX.registerScene({
    n: 'VOLUMETRIC GOD PASS', c: '#ffd54f',
    tags: ['pro', 'tunnel'],
    cost: 'high',
    rx: 2,
    fs: H + [
      'float dens(vec3 p){',
      '  float f=fbm(p.xy*1.4+p.z*.2);',
      '  float c=length(p.xy)-(.55+B*.12);',
      '  return exp(-c*c*6.)*(.25+f*.65);',
      '}',
      'void main(){',
      '  vec2 st=(uv-.5)*vec2(R.x/R.y,1.);',
      '  vec3 ro=vec3(0.,0.,-2.2);',
      '  vec3 rd=normalize(vec3(st,1.4));',
      '  float t=0.,a=0.;',
      '  vec3 col=vec3(0.);',
      '  float ls=mix(1.15,.82,LD);',
      '  for(int i=0;i<36;i++){',
      '    vec3 p=ro+rd*t;',
      '    float d=dens(p)*ls;',
      '    vec3 c=pal(p.z*.2+T*.03+PRO.x*.3);',
      '    a+=d*.045;',
      '    col+=c*d*.055*(1.+M*.4);',
      '    t+=.06;',
      '    if(a>1.1)break;',
      '  }',
      '  col=mix(vec3(.02,.03,.06),col,sat(a));',
      '  vec2 fuv=feedUV(1.002,0.,vec2(0));',
      '  col=mix(texture2D(PV,fuv).rgb*.86,col,.45+BT*.04);',
      '  gl_FragColor=vec4(col,1.);',
      '}'
    ].join('\n')
  });

  NX.registerScene({
    n: 'TEMPORAL FILM ACCUM', c: '#90caf9',
    tags: ['pro', 'calm'],
    cost: 'low',
    rx: 1,
    fs: H + [
      'void main(){',
      '  vec2 fuv=feedUV(1.0,0.,vec2(0));',
      '  vec3 prev=texture2D(PV,fuv).rgb;',
      '  float mv=(abs(prev.r-texture2D(PV,sat(fuv+vec2(.004,0))).r)+abs(prev.r-texture2D(PV,sat(fuv+vec2(0,.004))).r))*(.35+FL*.6);',
      '  vec3 live=pal(SC+T*.02+PRO.x*.25);',
      '  live*=(.35+B*.25+M*.2+H*.15);',
      '  float w=.78+PRO.w*.12;',
      '  vec3 col=mix(live,prev,w);',
      '  col*=(1.-mv*.12);',
      '  gl_FragColor=vec4(col,1.);',
      '}'
    ].join('\n')
  });

  NX.registerScene({
    n: 'GRAY-SCOTT ORGANISM', c: '#00e5ff',
    tags: ['pro', 'intense'],
    cost: 'high',
    rx: 2,
    fs: H + [
      'void main(){',
      '  vec2 px=1./R;',
      '  vec2 fuv=feedUV(1.0,0.,vec2(0));',
      '  vec3 pr=texture2D(PV,fuv).rgb;',
      '  float u=pr.r;',
      '  float v=pr.g;',
      '  float ul=texture2D(PV,sat(fuv+vec2(-px.x,0))).r;',
      '  float ur=texture2D(PV,sat(fuv+vec2(px.x,0))).r;',
      '  float uu=texture2D(PV,sat(fuv+vec2(0,-px.y))).r;',
      '  float ud=texture2D(PV,sat(fuv+vec2(0,px.y))).r;',
      '  float lap=(ul+ur+uu+ud)-4.*u;',
      '  float feed=.052+PRO.y*.018+B*.006;',
      '  float kill=.061+PRO.z*.016+H*.005;',
      '  float r=u*v*v;',
      '  float du=lap*.9+feed*(1.-u)-r;',
      '  float dv=lap*.35-kill*v+r;',
      '  float dt=.65;',
      '  u=sat(u+du*dt*(.7+BT*.25));',
      '  v=sat(v+dv*dt*(.7+BT*.25));',
      '  float inj=pow(B,.65)*.08+FL*.04;',
      '  u+=inj*(.5-uv.x);',
      '  v+=inj*uv.y;',
      '  vec3 col=vec3(u,v,u*v*3.4);',
      '  col=mix(vec3(.02,.04,.06),col,.92);',
      '  gl_FragColor=vec4(col,1.);',
      '}'
    ].join('\n')
  });

  NX.registerScene({
    n: 'HYPER SLICE 4D', c: '#ea80fc',
    tags: ['pro', 'fractal'],
    cost: 'high',
    rx: 2,
    fs: H + [
      'void main(){',
      '  vec2 p=(uv-.5)*2.2;',
      '  float w=sin(T*.11+PRO.x*TAU)*.65;',
      '  vec4 z4=vec4(p,w,0.);',
      '  float acc=0.;',
      '  for(int i=0;i<9;i++){',
      '    z4.xy=abs(z4.xy)-vec2(.62+M*.04);',
      '    z4*=1.35+sin(z4.w+T*.2)*.04;',
      '    z4.xy=rot2(T*.05+float(i)*.08)*z4.xy;',
      '    float d=sdOct(vec3(z4.xy,z4.z),.42);',
      '    acc+=exp(-d*6.)*(.12+BT*.08);',
      '  }',
      '  vec3 col=pal(acc+PRO.w*.3);',
      '  vec2 fuv=feedUV(1.003,0.,vec2(0));',
      '  col=mix(texture2D(PV,fuv).rgb*.85,col,.4);',
      '  gl_FragColor=vec4(col,1.);',
      '}'
    ].join('\n')
  });

  NX.registerScene({
    n: 'NAVIER SMOKE RIBBON', c: '#80cbc4',
    tags: ['pro', 'fluid'],
    cost: 'med',
    rx: 1,
    fs: H + [
      'vec2 curl(vec2 p){',
      '  float e=.014;',
      '  float a=fbm(p+vec2(0,e))-fbm(p-vec2(0,e));',
      '  float b=fbm(p+vec2(e,0))-fbm(p-vec2(e,0));',
      '  return vec2(a,-b);',
      '}',
      'void main(){',
      '  vec2 p=uv*6.;',
      '  vec2 v=curl(p+T*.07)*(.35+PRO.z);',
      '  float ad=fbm(p+v*2.+T*.12+B*.4);',
      '  float band=smoothstep(.35,.72,ad);',
      '  vec3 col=mix(vec3(.02,.06,.08),pal(.2+PRO.x*.5+M*.1),band);',
      '  col+=vec3(.4,.85,1.)*FL*.18;',
      '  vec2 fuv=feedUV(1.002,0.,vec2(0));',
      '  col=mix(texture2D(PV,fuv).rgb*.88,col,.36);',
      '  gl_FragColor=vec4(col,1.);',
      '}'
    ].join('\n')
  });

  NX.registerScene({
    n: 'CONSCIOUSNESS IFS', c: '#ff80ab',
    tags: ['pro', 'fractal'],
    cost: 'med',
    rx: 1,
    fs: H + [
      'void main(){',
      '  vec2 z=(uv-.5)*2.4;',
      '  float clr=0.;',
      '  float a1=.5+PRO.x*.4;',
      '  float a2=.35+PRO.w*.5;',
      '  float a3=.28+PRO.y*.55;',
      '  for(int k=0;k<22;k++){',
      '    float sel=mod(floor(float(k)*.37+T*1.3+BT*4.),3.);',
      '    if(sel<1.){',
      '      z=vec2(z.x*a1-z.y*a2,z.x*a2+z.y*a1)*1.42;',
      '    }else if(sel<2.){',
      '      z=vec2(sin(z.x*a3+T*.2),cos(z.y*a3-T*.15))*1.15;',
      '    }else{',
      '      z=abs(z)-vec2(.35+M*.05);',
      '      z*=1.25;',
      '    }',
      '    clr+=exp(-length(z))*(.08+BT*.04);',
      '  }',
      '  vec3 col=pal(clr+DNA.x*.2);',
      '  vec2 fuv=feedUV(1.002,0.,vec2(0));',
      '  col=mix(texture2D(PV,fuv).rgb*.86,col,.44);',
      '  gl_FragColor=vec4(col,1.);',
      '}'
    ].join('\n')
  });

  NX.registerScene({
    n: 'TYPO SDF EDGE', c: '#eceff1',
    tags: ['pro', 'chrome'],
    cost: 'low',
    rx: 1,
    fs: H + [
      'float gx(vec2 p){',
      '  p.x=abs(p.x);',
      '  float bar=sdBox(p-vec2(.35,0),vec2(.08,.55));',
      '  float slab=sdBox(p-vec2(-.15,0),vec2(.55,.12));',
      '  return min(bar,slab);',
      '}',
      'void main(){',
      '  vec2 p=(uv-.5)*2.;',
      '  p.x+=sin(T*.2+PRO.x)*.04;',
      '  float d=gx(p);',
      '  float a=1.-smoothstep(0.,.02+FL*.015,abs(d));',
      '  vec3 ed=pal(.6+sign(d)*.15+BT*.1);',
      '  vec3 bg=vec3(.02,.025,.03);',
      '  vec3 col=mix(bg,ed,a);',
      '  col+=vec3(1.)*pow(a,3.)*.25;',
      '  vec2 fuv=feedUV(1.001,0.,vec2(0));',
      '  col=mix(texture2D(PV,fuv).rgb*.9,col,.35);',
      '  gl_FragColor=vec4(col,1.);',
      '}'
    ].join('\n')
  });

  NX.registerScene({
    n: 'DISSOLVE SELF FIELD', c: '#a7ffeb',
    tags: ['pro', 'intense'],
    cost: 'med',
    rx: 1,
    fs: H + [
      'void main(){',
      '  vec2 p=(uv-.5)*2.;',
      '  float r=length(p-MX*.35);',
      '  float n=fbm(p*3.+T*.25+V*.8);',
      '  float d=sdSph(p,.72+n*.12-B*.08);',
      '  float m=1.-smoothstep(0.,.55,r+PRO.z*.25);',
      '  vec3 col=pal(n+T*.03);',
      '  col*=exp(-d*2.2)*(.35+BT*.45);',
      '  col+=vec3(.2,.9,.75)*m*.18;',
      '  vec2 fuv=feedUV(1.003,MX.x*.02,MX.y*.02);',
      '  col=mix(texture2D(PV,fuv).rgb*.87,col,.48);',
      '  gl_FragColor=vec4(col,1.);',
      '}'
    ].join('\n')
  });

  NX.registerScene({
    n: 'SIGNAL OUTPOST', c: '#b0bec5',
    tags: ['pro', 'chrome'],
    cost: 'low',
    rx: 1,
    fs: H + [
      'void main(){',
      '  vec2 p=uv;',
      '  float bars=0.;',
      '  for(int i=0;i<32;i++){',
      '    float x=(float(i)+.5)/32.;',
      '    float h=texture2D(AU,vec2(x,.25)).r;',
      '    float t=abs(p.x-x)*32.;',
      '    bars+=smoothstep(.12,.02,t)*smoothstep(0.,h,p.y*.9);',
      '  }',
      '  vec3 col=mix(vec3(.03,.04,.06),vec3(.75,.9,1.),bars);',
      '  col+=vec3(.2,1.,.5)*PRO.w*.12;',
      '  vec2 fuv=feedUV(1.0,0.,vec2(0));',
      '  col=mix(texture2D(PV,fuv).rgb*.92,col,.28);',
      '  gl_FragColor=vec4(col,1.);',
      '}'
    ].join('\n')
  });

  NX.registerScene({
    n: 'NARRATIVE ARC SKY', c: '#7986cb',
    tags: ['pro', 'calm'],
    cost: 'low',
    rx: 1,
    fs: H + [
      'void main(){',
      '  float arc=sin(uv.y*3.14159+T*.04+DNA.y*2.);',
      '  float ph=DNA.x*TAU+T*.05;',
      '  vec2 p=uv+vec2(sin(ph)*.02,cos(ph*.7)*.02);',
      '  float g=fbm(p*2.2+T*.08);',
      '  float band=smoothstep(.25,.85,uv.y+g*.15+arc*.08);',
      '  vec3 low=pal(.1+PRO.x*.3);',
      '  vec3 high=pal(.55+M*.1);',
      '  vec3 col=mix(low,high,band);',
      '  col+=vec3(1.,.85,.55)*pow(1.-uv.y,3.)*(.12+B*.15);',
      '  vec2 fuv=feedUV(1.001,0.,vec2(0));',
      '  col=mix(texture2D(PV,fuv).rgb*.9,col,.3);',
      '  gl_FragColor=vec4(col,1.);',
      '}'
    ].join('\n')
  });
})();
