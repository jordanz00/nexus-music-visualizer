'use strict';
/*  vision.js — Fractal / tunnel / sacred-geometry raymarch scenes (LOD via LD uniform).
    Uses BP, PH, BC from engine for BPM-aware motion. Inspired by common SDF patterns. */

(function () {
  var H = NX.HEAD;

  NX.registerScene({
    n: 'APOLLONIAN WEB', rx: 2, c: '#7c4dff',
    fs: H + [
      'float apo(vec3 p){',
      '  p.xz*=rot2(T*SP*.04+PH*2.);',
      '  float s=1.2+B*.25;',
      '  float d=1e9;',
      '  int mx=int(mix(3.,7.,LD));',
      '  for(int i=0;i<8;i++){',
      '    if(i>=mx)break;',
      '    p=abs(p)-vec3(s,s*.6,s);',
      '    p=rotY(.55+M*.2)*p;',
      '    d=min(d,sdSph(p,s*.35));',
      '    s*=.58;',
      '  }',
      '  return d;',
      '}',
      'vec3 gna(vec3 p){vec2 e=vec2(.003,0);',
      ' return normalize(vec3(apo(p+e.xyy)-apo(p-e.xyy),apo(p+e.yxy)-apo(p-e.yxy),apo(p+e.yyx)-apo(p-e.yyx)));}',
      'void main(){',
      '  vec2 st=(gl_FragCoord.xy-.5*R)/R.y;',
      '  vec3 ro=vec3(0.,0.,-4.-sin(T*.1)*.6);',
      '  ro.xy+=MX*.4;',
      '  vec3 ta=vec3(sin(T*.07)*.3,0.,0.);',
      '  mat3 cm=camMat(ro,ta,0.);',
      '  vec3 rd=cm*normalize(vec3(st,1.65));',
      '  float t=0.;vec3 col=vec3(0.);',
      '  int steps=int(mix(36.,84.,LD));',
      '  for(int i=0;i<88;i++){',
      '    if(i>=steps)break;',
      '    vec3 p=ro+rd*t;',
      '    float d=apo(p);',
      '    if(d<.01){',
      '      vec3 n=gna(p);',
      '      vec3 base=pal(dot(p,vec3(.3,.5,.2))+T*.05);',
      '      col=blinnPhong(n,rd,normalize(vec3(-.3,.8,.2)),base,.12);',
      '      col+=vec3(.5,.7,1.)*pow(sat(dot(reflect(rd,n),normalize(vec3(.2,1.,.1)))),12.)*(.5+FL*.4);',
      '      break;',
      '    }',
      '    if(t>22.)break;',
      '    t+=d*.9;',
      '  }',
      '  col+=vec3(.04,.02,.12)*(1.+sin(st.x*8.+T)*.05);',
      '  vec2 fuv=feedUV(1.002,0.,vec2(sin(T*.02)*.01,0));',
      '  col=mix(texture2D(PV,fuv).rgb*.9,col,.3);',
      '  gl_FragColor=vec4(sat(col),1.);',
      '}'
    ].join('\n')
  });

  NX.registerScene({
    n: 'SACRED MANDALA', rx: 1, c: '#ffd740',
    fs: H + [
      'void main(){',
      '  vec2 st=(gl_FragCoord.xy-.5*R)/R.y;',
      '  float r=length(st)+1e-4;',
      '  float a=atan(st.y,st.x);',
      '  float seg=6.+floor(M*4.+PH*2.);',
      '  float a2=abs(mod(a+3.14159/seg,6.28318/seg)-3.14159/seg);',
      '  vec2 p2=vec2(cos(a2),sin(a2))*r;',
      '  float rings=sin(10./(r+.08)+T*SP*.2-B*2.)*cos(a*seg+T*.5);',
      '  float core=sin(length(p2)*14.-T*SP*.4+H*3.+BT*2.);',
      '  float pat=rings*.5+core*.35;',
      '  vec3 c=pal(pat+texture2D(AU,vec2(sat(r),.08)).r*.12);',
      '  c*=exp(-r*1.1)*(1.2+BT*.8+B*.4);',
      '  c+=vec3(1.,.85,.5)*smoothstep(.02,.08,abs(r-.35))*BT*.7;',
      '  vec2 fuv=feedUV(1.01,PH*.04,vec2(0));',
      '  c=mix(texture2D(PV,fuv).rgb*.9,c,.55+FL*.1);',
      '  gl_FragColor=vec4(sat(c),1.);',
      '}'
    ].join('\n')
  });

  NX.registerScene({
    n: 'INFLECT CORRIDOR', rx: 2, c: '#69f0ae',
    fs: H + [
      'float cor(vec3 p){',
      '  p.xy=abs(p.xy);',
      '  p.xy-=vec2(.55,.55);',
      '  p=abs(p);',
      '  float d=sdBox(p-vec3(0,0,opRep1(p.z-T*SP*.4,2.4)),vec3(.18,.18,.35));',
      '  return d;',
      '}',
      'void main(){',
      '  vec2 st=(gl_FragCoord.xy-.5*R)/R.y;',
      '  vec3 ro=vec3(.05*sin(T*.1),0.,T*SP*.45);',
      '  ro.xy+=MX.xy*.12;',
      '  vec3 rd=rotY(sin(ro.z*.5)*.15)*normalize(vec3(st.x*.9,st.y,1.));',
      '  float t=0.;vec3 col=vec3(.015,.03,.025);',
      '  int steps=int(mix(36.,80.,LD));',
      '  for(int i=0;i<84;i++){',
      '    if(i>=steps)break;',
      '    vec3 p=ro+rd*t;',
      '    float d=cor(p);',
      '    if(d<.012){',
      '      vec2 e=vec2(.0025,0);',
      '      vec3 n=normalize(vec3(cor(p+e.xyy)-cor(p-e.xyy),cor(p+e.yxy)-cor(p-e.yxy),cor(p+e.yyx)-cor(p-e.yyx)));',
      '      vec3 em=mix(vec3(.1,.4,.25),vec3(.9,1.,.75),sat(sin(p.z*3.+T)*.5+.5));',
      '      col=blinnPhong(n,rd,normalize(vec3(.2,.5,.4)),em,.18);',
      '      col+=vec3(.4,1.,.7)*BT*.25;',
      '      break;',
      '    }',
      '    t+=d*.92;',
      '    if(t>35.)break;',
      '  }',
      '  col=mix(col,vec3(0,.02,.015),1.-exp(-t*.035));',
      '  vec2 fuv=feedUV(1.002,0.,vec2(0));',
      '  col=mix(texture2D(PV,fuv).rgb*.87,col,.22);',
      '  gl_FragColor=vec4(sat(col),1.);',
      '}'
    ].join('\n')
  });
})();
