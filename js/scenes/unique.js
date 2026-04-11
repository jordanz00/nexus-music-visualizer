'use strict';
/*  unique.js — Non–Aurora signature WebGL scenes (polar tunnel + feedback).
    Registered like other scene modules via NX.registerScene + NX.HEAD.        */

(function () {
  var H = NX.HEAD;

  /* ---------------------------------------------------------------
     1. TUNNEL GRID  (#7c4dff)
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
