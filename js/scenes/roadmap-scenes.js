'use strict';
/**
 * roadmap-scenes.js — Scenes appended last so existing demo-director indices stay stable.
 * SPECTRAL HELIX / PRISM ORBIT: AudioWorklet-driven WM/WC uniforms + AU / BPM phase.
 */
(function () {
  var H = NX.HEAD;

  NX.registerScene({
    n: 'SPECTRAL HELIX', rx: 1, c: '#00e5ff', tags: ['intense'],
    fs: H + [
      'void main(){',
      '  vec2 st=(uv-.5)*vec2(R.x/R.y,1.);',
      '  float ang=atan(st.y,st.x);',
      '  float rr=length(st);',
      '  float hel=sin(ang*3.+rr*12.-T*SP*1.2+PH*TAU*2.)*cos(rr*8.-M*3.+FL*4.);',
      '  float au=texture2D(AU,vec2(fract(ang/TAU+WM*.18),.32+rr*.38)).r;',
      '  vec3 c=pal(hel*.28+au*.65+BC*.18);',
      '  c*=1.+BT*.55+B*.45;',
      '  c+=vec3(.15,.82,1.)*WC*.42*exp(-rr*2.8);',
      '  vec2 fuv=feedUV(1.01+B*.014,.0022*SP,vec2(sin(T*.19)*.007,cos(T*.16)*.006));',
      '  c=mix(texture2D(PV,fuv).rgb*.88,c,.54+FL*.1);',
      '  gl_FragColor=vec4(sat(c),1.);',
      '}'
    ].join('\n')
  });

  NX.registerScene({
    n: 'PRISM ORBIT', rx: 1, c: '#ff3d81', tags: ['intense'], cost: 'med',
    fs: H + [
      'float scn(vec3 p){',
      '  vec3 q=p-vec3(sin(T*SP*.4)*.25,M*.12,cos(T*SP*.32)*.25);',
      '  float sp=sdSph(q,.17+WM*.11+B*.06);',
      '  float tr=sdTorus(p,.52,.048+BT*.038);',
      '  return min(sp,tr);',
      '}',
      'void main(){',
      '  vec2 sc=(uv-.5)*vec2(R.x/R.y,1.)*2.15;',
      '  float ca=T*SP*.11+PH*TAU*.35;',
      '  vec3 ro=vec3(sin(ca)*.55,.28+MX.y*.35,cos(ca)*.55);',
      '  mat3 cm=camMat(ro,vec3(0),BP*.25);',
      '  vec3 rd=cm*normalize(vec3(sc,-1.25));',
      '  float t=0.;vec3 col=vec3(.015,.018,.04);',
      '  for(int i=0;i<52;i++){',
      '    vec3 pp=ro+rd*t;',
      '    float d=scn(pp);',
      '    if(d<.007){',
      '      vec3 e=vec3(.0024,0,0);',
      '      vec3 n=normalize(vec3(',
      '        scn(pp+e.xyy)-scn(pp-e.xyy),',
      '        scn(pp+e.yxy)-scn(pp-e.yxy),',
      '        scn(pp+e.yyx)-scn(pp-e.yyx)));',
      '      vec3 l=normalize(vec3(.45,.75,.4));',
      '      float dif=sat(dot(n,l));',
      '      col=pal(t*.11+M*.25+dif*.35)*(.22+dif*.88);',
      '      col+=vec3(.9,.35,.55)*WC*.32;',
      '      col+=vec3(.4,.85,1.)*pow(sat(dot(n,-rd)),3.)*(.25+BT*.2);',
      '      break;',
      '    }',
      '    t+=max(d*.78,.0045);',
      '    if(t>5.5)break;',
      '  }',
      '  vec2 fuv=feedUV(1.011,.0035*SP,vec2(0));',
      '  col=mix(texture2D(PV,fuv).rgb*.9,col,.48+B*.06);',
      '  gl_FragColor=vec4(sat(col),1.);',
      '}'
    ].join('\n')
  });
})();
