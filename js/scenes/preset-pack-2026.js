'use strict';
/**
 * preset-pack-2026.js — PRESET_PACK_2026: 30 new WebGL scenes (15 particle-field, 15 2D/hybrid).
 * Registered after roadmap-scenes.js. Names align with product plan IDs P3D-* / P2D-*.
 */
(function () {
  var H = NX.HEAD;

  function reg(n, c, tags, cost, rx, fsBody) {
    NX.registerScene({ n: n, c: c, tags: tags || ['intense'], cost: cost || 'med', rx: rx != null ? rx : 1, fs: H + fsBody });
  }

  /* ---------- P3D: particle / field “hero” looks (WebGL quad) ---------- */
  reg('GRAVITON CHOIR', '#6af0ff', ['intense'], 'high', 2,
    ['void main(){',
    ' vec2 p=(uv-.5)*vec2(R.x/R.y,1.); vec3 c=vec3(0.015,0.02,0.04);',
    ' for(int i=0;i<40;i++){ float fi=float(i); float a=fi*.471+T*SP*.11+B*.4;',
    '  vec2 o=vec2(cos(a),sin(a))*(.12+.35*fract(fi*.1731));',
    '  float w=1./(length(p-o)+.04); c+=pal(fi*.027)*w*.018*(1.+B*.6); }',
    ' vec2 f=feedUV(1.01,.002,vec2(sin(T*.1)*.004,0)); c=mix(texture2D(PV,f).rgb*.9,c,.35);',
    ' gl_FragColor=vec4(sat(c),1.);}'].join('\n'));

  reg('PHOTON CASCADE', '#ff6ec7', ['intense'], 'high', 2,
    ['void main(){ vec2 p=(uv-.5)*vec2(R.x/R.y,1.); vec3 c=vec3(.02,.01,.04);',
    ' float a=atan(p.y,p.x); float r=length(p);',
    ' for(int k=0;k<28;k++){ float fk=float(k); float ang=a+fk*.21-T*SP*.25;',
    '  float rad=.05+fk*.018; vec2 q=vec2(cos(ang),sin(ang))*rad*(1.2+B);',
    '  c+=pal(fk*.04+r)*exp(-length(p-q)*35.)*(.12+BT*.15); }',
    ' vec2 f=feedUV(1.008,.0015,vec2(0)); c=mix(texture2D(PV,f).rgb,c,.42);',
    ' gl_FragColor=vec4(sat(c),1.);}'].join('\n'));

  reg('HELIOS MIST', '#ffd54f', ['intense'], 'med', 1,
    ['void main(){ vec2 p=(uv-.5)*vec2(R.x/R.y,1.); float d=fbm(p*3.2+T*.08);',
    ' float m=texture2D(AU,vec2(d,.5)).r; vec3 c=pal(d*.3+m*.2)*(.25+V*.35);',
    ' c+=vec3(1.,.85,.55)*pow(sat(1.-length(p)*1.1),3.)*(.15+H*.2);',
    ' gl_FragColor=vec4(sat(c),1.);}'].join('\n'));

  reg('QUANTUM DRIFT', '#7e57c2', ['intense'], 'high', 2,
    ['void main(){ vec2 p=(uv-.5)*vec2(R.x/R.y,1.); vec3 c=vec3(.01);',
    ' for(int i=0;i<32;i++){ float fi=float(i); vec2 q=p+rot2(T*SP*.05+fi*.2)*vec2(.08*sin(fi),cos(fi*.7)*.06);',
    '  float n=fbm(q*6.+M*2.); c+=pal(n+fi*.03)*(.04/(float(i)+4.)); }',
    ' gl_FragColor=vec4(sat(c*2.2),1.);}'].join('\n'));

  reg('STELLAR LINT', '#e0f7fa', ['intense'], 'med', 2,
    ['void main(){ vec2 p=(uv-.5)*vec2(R.x/R.y,1.); vec3 c=vec3(.01,.015,.04);',
    ' for(int s=0;s<55;s++){ float fs=float(s); vec2 rnd=vec2(h11(fs+1.3),h11(fs+9.1))-.5;',
    '  vec2 star=rnd*1.8; float br=step(.992,1.-length(p-star*.9));',
    '  br*=step(.85,1.-abs(sin(fs+T*SP*.8+BT*6.))); c+=vec3(.9,.95,1.)*br*(.4+FL*.25); }',
    ' c+=pal(length(p)+T*.02)*.08; gl_FragColor=vec4(sat(c),1.);}'].join('\n'));

  reg('NEBULA LATTICE', '#b388ff', ['intense'], 'high', 2,
    ['void main(){ vec2 p=(uv-.5)*vec2(R.x/R.y,1.);',
    ' float g=sin(p.x*18.+M*2.)*sin(p.y*18.-T*.4)+sin((p.x+p.y)*14.+B*3.);',
    ' vec3 c=pal(g*.08+length(p))*.35; vec3 ro=vec3(p*1.2,sin(T*SP*.1));',
    ' float lat=sdBox(ro,vec3(.35,.02,.35)); c+=vec3(.5,.3,.9)*exp(-lat*3.)*.25;',
    ' gl_FragColor=vec4(sat(c),1.);}'].join('\n'));

  reg('AURORA PLUME', '#69f0ae', ['intense'], 'med', 1,
    ['void main(){ vec2 p=(uv-.5)*vec2(R.x/R.y,1.); float a=atan(p.y,p.x);',
    ' float r=length(p)+1e-4; float rib=sin(a*5.+r*20.-T*SP*.6+PH*6.28);',
    ' vec3 c=pal(rib*.15+r)*smoothstep(1.2,.05,r)*(1.+BT*.5);',
    ' gl_FragColor=vec4(sat(c),1.);}'].join('\n'));

  reg('MAGNETopause', '#448aff', ['intense'], 'high', 2,
    ['void main(){ vec2 p=(uv-.5)*vec2(R.x/R.y,1.); vec3 c=vec3(.01,.02,.05);',
    ' for(int i=0;i<24;i++){ float fi=float(i); float t=fi*.262;',
    '  vec2 v=rot2(t+p.x*2.)*vec2(.35,.08); vec2 q=p-v;',
    '  c+=pal(fi*.05)*.015/(length(q)+.06); } c*=1.+B*.35;',
    ' gl_FragColor=vec4(sat(c),1.);}'].join('\n'));

  reg('HIGGS VEIL', '#cfd8dc', ['intense'], 'high', 1,
    ['void main(){ vec2 p=(uv-.5)*vec2(R.x/R.y,1.); float r=length(p);',
    ' float h=sin(r*22.-T*SP*.35+M*2.)*exp(-r*2.1); vec3 c=vec3(.03)+pal(h)*h*h*4.;',
    ' c+=vec3(1.,.9,.95)*exp(-r*8.)*(.2+BT*.25); gl_FragColor=vec4(sat(c),1.);}'].join('\n'));

  reg('CHROMO SWARM', '#ff4081', ['intense'], 'med', 2,
    ['void main(){ vec2 p=(uv-.5)*vec2(R.x/R.y,1.); vec3 c=vec3(.02);',
    ' for(int i=0;i<36;i++){ float fi=float(i); float ang=T*SP*.12+fi*.37;',
    '  vec2 o=.45*vec2(cos(ang),sin(ang))*fract(fi*.413);',
    '  float d=length(p-o); c+=.012*pal(SC+fi*.02)/(d+.03); }',
    ' gl_FragColor=vec4(sat(c),1.);}'].join('\n'));

  reg('ION STORM', '#80deea', ['intense'], 'high', 2,
    ['void main(){ vec2 p=(uv-.5)*vec2(R.x/R.y,1.); vec3 c=vec3(.01,.03,.06);',
    ' float a=atan(p.y,p.x); for(int b=0;b<12;b++){ float fb=float(b);',
    '  float j=.02*sin(a*9.+fb+T*3.)+M*.01; vec2 q=p-vec2(cos(a+j),sin(a+j))*(.2+fb*.04);',
    '  c+=vec3(.7,.95,1.)*exp(-length(q)*90.)*(.15+BT*.2); }',
    ' gl_FragColor=vec4(sat(c),1.);}'].join('\n'));

  reg('TESSERACT RAIN', '#ea80fc', ['intense'], 'high', 2,
    ['void main(){ vec2 p=(uv-.5)*vec2(R.x/R.y,1.); vec3 c=vec3(.02);',
    ' float w=sin(T*SP*.2); for(int i=0;i<30;i++){ float fi=float(i);',
    '  vec3 q=vec3(p*.9,fract(fi*.07-T*.2)); q.xy=rot2(w*.5)*q.xy;',
    '  float z=mod(q.z*6.+fi*.1,1.); c+=pal(z)*.03/(length(q.xy)+.04); }',
    ' gl_FragColor=vec4(sat(c),1.);}'].join('\n'));

  reg('LIDAR BLOOM', '#00e676', ['intense'], 'med', 1,
    ['void main(){ vec2 p=(uv-.5)*vec2(R.x/R.y,1.); float a=atan(p.y,p.x);',
    ' float sweep=sin(a*1.+T*SP*1.2); float r=length(p);',
    ' float hit=smoothstep(.02,.0,abs(sweep-.15*r)); vec3 c=vec3(.01,.04,.02);',
    ' c+=vec3(.2,1.,.5)*hit*exp(-r*1.8)*(.4+M*.3); c+=pal(r+a)*.08;',
    ' gl_FragColor=vec4(sat(c),1.);}'].join('\n'));

  reg('PLASMA LOOM', '#ff9100', ['intense'], 'high', 2,
    ['void main(){ vec2 p=(uv-.5)*vec2(R.x/R.y,1.);',
    ' float u=sin(p.x*12.+B*2.)*cos(p.y*12.-H*2.); float v=cos(p.x*9.-T)*sin(p.y*9.+T);',
    ' vec3 c=pal(u+v+FL*.2)*(.35+BT*.25); vec2 f=feedUV(1.005,.001,vec2(0));',
    ' c=mix(texture2D(PV,f).rgb*.85,c,.5); gl_FragColor=vec4(sat(c),1.);}'].join('\n'));

  reg('SINGULARITY PARADE', '#ff1744', ['intense'], 'high', 2,
    ['void main(){ vec2 p=(uv-.5)*vec2(R.x/R.y,1.); float r=length(p)+1e-4;',
    ' float a=atan(p.y,p.x); float d=sin(a*8.-T*SP*.4)/(r+.15);',
    ' vec3 c=pal(d+M)*smoothstep(1.4,.08,r); c+=vec3(1.,.3,.2)*pow(1.-sat(r*1.2),4.)*(.35+B*.2);',
    ' gl_FragColor=vec4(sat(c),1.);}'].join('\n'));

  /* ---------- P2D: shader / post-friendly 2D looks ---------- */
  reg('METROPLEX GRID', '#00bcd4', ['intense'], 'low', 1,
    ['void main(){ vec2 p=(uv-.5)*vec2(R.x/R.y,1.);',
    ' float scan=sin(p.y*R.y*.08+T*SP*2.); vec3 c=vec3(.02,.03,.06);',
    ' float g=step(fract(p.x*20.+T*.1),.5)*step(fract(p.y*20.),.5);',
    ' c+=vec3(.1,.8,.95)*g*(.15+scan*.05+M*.1); gl_FragColor=vec4(sat(c),1.);}'].join('\n'));

  reg('LIQUID METAL CRT', '#90a4ae', ['intense'], 'med', 1,
    ['void main(){ vec2 p=(uv-.5)*vec2(R.x/R.y,1.);',
    ' float m=sin(length(p)*8.-T*SP*.5)*.5+.5; vec3 c=vec3(.15)+vec3(.7,.75,.8)*m;',
    ' float drip=sin(p.x*30.+fbm(p*4.+T*.2)*3.)*.5+.5; c*=drip*.6+.4;',
    ' gl_FragColor=vec4(sat(c),1.);}'].join('\n'));

  reg('ANAGLYPH MEMORY', '#f50057', ['intense'], 'med', 2,
    ['void main(){ vec2 p=uv; vec2 o=vec2(.004+FL*.006,0);',
    ' vec3 a=texture2D(PV,p+o).rgb; vec3 b=texture2D(PV,p-o).rgb;',
    ' vec3 c=vec3(a.r,b.g,a.b)*(.55+M*.15)+pal(length(uv-.5))*.12;',
    ' gl_FragColor=vec4(sat(c),1.);}'].join('\n'));

  reg('WAVEVECTOR HUD', '#76ff03', ['intense'], 'low', 1,
    ['void main(){ vec2 p=(uv-.5)*vec2(R.x/R.y,1.); float s=texture2D(AU,vec2(uv.x,.25)).r;',
    ' float y=sin(p.x*40.+T*2.)*.12*s; vec3 c=vec3(.01,.04,.02);',
    ' c+=vec3(.2,1.,.4)*smoothstep(.02,.0,abs(p.y-y))*(.4+B*.3);',
    ' gl_FragColor=vec4(sat(c),1.);}'].join('\n'));

  reg('BIOLUM WIRE', '#18ffff', ['intense'], 'med', 1,
    ['void main(){ vec2 f=feedUV(1.01,.002,vec2(0)); vec3 b=texture2D(PV,f).rgb;',
    ' float e=abs(b.r-b.g)+abs(b.g-b.b); vec3 c=vec3(.01)+b*.3+vec3(.1,.9,.8)*e*2.;',
    ' gl_FragColor=vec4(sat(c),1.);}'].join('\n'));

  reg('GLITCH TRIBUNAL', '#ff6d00', ['intense'], 'high', 2,
    ['void main(){ vec2 p=uv; float q=floor(p.y*12.+BT*4.); float chop=mod(q+floor(T*8.),2.);',
    ' p.x+=chop*.03*sin(T*20.+p.y*30.); vec3 c=texture2D(PV,p).rgb;',
    ' c=mix(c,pal(BT+M),.15*chop); gl_FragColor=vec4(sat(c),1.);}'].join('\n'));

  reg('IRIS BLOOM TUNNEL', '#d500f9', ['intense'], 'med', 1,
    ['void main(){ vec2 p=(uv-.5); float r=length(p)+1e-4; float a=atan(p.y,p.x);',
    ' float k=sin(a*7.+T*SP*.5)*.1; vec3 c=pal(log(r)+k)*smoothstep(.55,.02,r);',
    ' c+=vec3(1.,.4,.9)*pow(1.-sat(r*1.8),3.)*.35; gl_FragColor=vec4(sat(c),1.);}'].join('\n'));

  reg('ANALOG HEAT HAZE', '#ffab40', ['calm'], 'low', 1,
    ['void main(){ vec2 p=uv+vec2(fbm(uv*5.)-.5,fbm(uv*5.+4.)-.5)*.012*(1.+V);',
    ' vec3 c=pal(texture2D(AU,vec2(uv.x,.2)).r+length(uv-.5));',
    ' c=mix(vec3(.08,.06,.04),c,.85); c+=vec3(.15)*fbm(uv*12.+T*.05);',
    ' gl_FragColor=vec4(sat(c),1.);}'].join('\n'));

  reg('CYMATIC PLATE', '#64ffda', ['intense'], 'med', 1,
    ['void main(){ vec2 p=(uv-.5)*vec2(R.x/R.y,1.); float s=texture2D(AU,vec2(.5,.1)).r;',
    ' float w=sin(length(p)*28.+s*6.)*cos(atan(p.y,p.x)*5.+M*3.);',
    ' vec3 c=vec3(.02)+pal(w)*sat(abs(w))*(.5+B*.3); gl_FragColor=vec4(sat(c),1.);}'].join('\n'));

  reg('NOIR FOG BANK', '#37474f', ['calm'], 'low', 1,
    ['void main(){ vec2 p=(uv-.5)*vec2(R.x/R.y,1.); float f=1.-smoothstep(.2,1.2,length(p));',
    ' vec3 c=mix(vec3(.02,.02,.03),vec3(.08,.09,.12),f); c+=pal(atan(p.y,p.x)*.05)*f*.15;',
    ' gl_FragColor=vec4(sat(c),1.);}'].join('\n'));

  reg('CHRONO STRIPES', '#651fff', ['intense'], 'med', 2,
    ['void main(){ vec2 f=feedUV(1.02+FL*.02,.004,vec2(T*.01,0));',
    ' vec3 c=texture2D(PV,f).rgb*.75+pal(uv.x+T*.2)*.12;',
    ' float st=sin(uv.x*60.+T*SP); c+=vec3(.4,.2,1.)*st*st*.04;',
    ' gl_FragColor=vec4(sat(c),1.);}'].join('\n'));

  reg('HOLO DECK SCAN', '#00bfa5', ['intense'], 'low', 1,
    ['void main(){ vec2 p=(uv-.5)*vec2(R.x/R.y,1.); float a=atan(p.y,p.x);',
    ' float r=length(p); float sweep=smoothstep(-.05,.05,sin(a-T*SP*1.5)-r*.8);',
    ' vec3 c=vec3(.01,.04,.05)+vec3(0.,1.,.9)*sweep*(.25+H*.2);',
    ' gl_FragColor=vec4(sat(c),1.);}'].join('\n'));

  reg('ACID ETCH CHROME', '#eceff1', ['intense'], 'med', 1,
    ['void main(){ vec2 p=(uv-.5)*vec2(R.x/R.y,1.); float d=abs(length(p)-.35)-.02;',
    ' float s=smoothstep(.04,.0,d); vec3 c=vec3(.25,.28,.32)*s;',
    ' c+=vec3(1.,.2,.6)*(1.-s)*pal(M)*.15; gl_FragColor=vec4(sat(c),1.);}'].join('\n'));

  reg('ZENITH RINGS', '#3d5afe', ['calm'], 'low', 1,
    ['void main(){ vec2 p=(uv-.5)*vec2(R.x/R.y,1.); float r=length(p);',
    ' float rings=sin(r*40.-T*SP*.8+M*2.)*.5+.5; vec3 c=pal(rings+r)*rings*.35;',
    ' gl_FragColor=vec4(sat(c),1.);}'].join('\n'));

  reg('VELVET STROBE', '#880e4f', ['calm'], 'low', 1,
    ['void main(){ vec2 p=uv-.5; float r=length(p);',
    ' float pulse=.12+.08*sin(T*6.28*2.+PH*6.28)*(.2+BC); pulse*=1.-smoothstep(.4,1.3,r);',
    ' vec3 c=vec3(.08,.02,.06)+vec3(.4,.1,.25)*pulse; c+=pal(r+T*.05)*.08;',
    ' gl_FragColor=vec4(sat(c),1.);}'].join('\n'));
})();
