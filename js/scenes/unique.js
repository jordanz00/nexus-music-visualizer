'use strict';
/*  unique.js — Non–Aurora signature WebGL scenes (2D feedback + polar tunnel).
    Registered like other scene modules via NX.registerScene + NX.HEAD.        */

(function () {
  var H = NX.HEAD;

  /* ---------------------------------------------------------------
     1. ECHO LATTICE  (#00ffc8)
     Interference lattice + light PV feedback; reads distinct from
     typical milkdrop-style smear (tighter zoom, grid phase).
  --------------------------------------------------------------- */
  NX.registerScene({
    n: 'ECHO LATTICE', rx: 2, c: '#00ffc8',
    fs: H + [
      'void main(){',
      '  vec2 st=(gl_FragCoord.xy-.5*R)/R.y;',
      '  vec2 fuv=feedUV(1.008+B*.018,T*.0012+FL*.002,vec2(sin(T*.18)*.012,cos(T*.14)*.01));',
      '  vec3 pv=texture2D(PV,fuv).rgb;',
      '  float gx=sin(st.x*14.+T*SP*.28)*sin(st.y*14.-T*.22);',
      '  float gy=sin((st.x+st.y)*11.+M*2.1+B*1.4);',
      '  float ph=gx*.5+gy*.35+BT*.25;',
      '  vec3 c=pal(ph+length(st)*.4+texture2D(AU,vec2(sat(.5+st.x),.12)).r*.08);',
      '  c=mix(pv*.92,c,.42+B*.12+FL*.08);',
      '  c+=vec3(.15,.95,.82)*BT*.2*exp(-dot(st,st)*1.8);',
      '  gl_FragColor=vec4(pow(sat(c),vec3(.9)),1.);',
      '}'
    ].join('\n')
  });

  /* ---------------------------------------------------------------
     2. TUNNEL GRID  (#7c4dff)
     Fake polar “tunnel” depth + drifting grid; weighted random picks
     favor it slightly via rx when mic is hot.
  --------------------------------------------------------------- */
  NX.registerScene({
    n: 'TUNNEL GRID', rx: 2, c: '#7c4dff',
    fs: H + [
      'void main(){',
      '  vec2 sc=(gl_FragCoord.xy-.5*R)/R.y;',
      '  float r=length(sc)+1e-4;',
      '  float a=atan(sc.y,sc.x);',
      '  float z=1.6/r+T*SP*.35;',
      '  float grid=sin(z*10.+a*6.+B*2.)*cos(z*8.-a*4.+M*1.8);',
      '  vec3 c=pal(grid*.22+z*.04+FL*.08+H*.05);',
      '  c*=smoothstep(2.4,.12,r)*(1.+BT*.4);',
      '  vec2 fuv=feedUV(1.006,.0008*SP,vec2(0));',
      '  c=mix(texture2D(PV,fuv).rgb*.55,c,.62);',
      '  gl_FragColor=vec4(pow(sat(c),vec3(.88)),1.);',
      '}'
    ].join('\n')
  });
})();
