'use strict';
/*  environment.js — Environment / world scenes.
    NEON GRID only (STARSHIP BRIDGE culled; NEBULA FLYTHROUGH removed) */

(function () {
  var H = NX.HEAD;

  /* (STARSHIP BRIDGE culled — less visually striking) */

  /* ---------------------------------------------------------------
     1. NEON GRID  (#39ff14)
     Tron-style infinite ground plane, audio-column heights from
     AU texture, scanning line, grid glow, horizon.
  --------------------------------------------------------------- */
  NX.registerScene({
    n: 'NEON GRID', c: '#39ff14',
    fs: H + [
      'float mp(vec3 p){',
      '  vec2 id=floor(p.xz/2.);vec3 lp=vec3(mod(p.x,2.)-1.,p.y,mod(p.z,2.)-1.);',
      '  float au=texture2D(AU,vec2(abs(h21(id))*.49,0.)).r;',
      '  float ht=au*3.+.5+B;',
      '  return min(p.y,sdBox(lp-vec3(0,ht*.5,0),vec3(.12,ht*.5,.12)));',
      '}',
      'vec3 nm(vec3 p){vec2 e=vec2(.01,0);return normalize(vec3(mp(p+e.xyy)-mp(p-e.xyy),mp(p+e.yxy)-mp(p-e.yxy),mp(p+e.yyx)-mp(p-e.yyx)));}',
      'void main(){',
      '  vec2 st=(gl_FragCoord.xy-.5*R)/R.y;',
      '  vec3 ro=vec3(sin(T*.08)*6.,3.5+MX.y*2.,T*2.*SP+cos(T*.08)*6.);',
      '  vec3 ta=ro+vec3(sin(T*.08+.5)*3.,-2.,cos(T*.08+.5)*3.);',
      '  mat3 cm=camMat(ro,ta,sin(T*.05)*.02);',
      '  vec3 rd=cm*normalize(vec3(st,1.6));',
      '  float t=0.;vec3 col=vec3(0.);',
      '  for(int i=0;i<56;i++){float d=mp(ro+rd*t);',
      '    if(d<.02){',
      '      vec3 p=ro+rd*t,n=nm(p);',
      '      if(abs(n.y)>.8){',
      '        vec2 grd=abs(fract(p.xz)-.5);',
      '        float line=smoothstep(.02,.0,min(grd.x,grd.y));',
      '        float scan=smoothstep(.1,.0,abs(mod(p.z-T*3.,40.)-20.));',
      '        col=vec3(.15,1.,.05)*(line*.4+scan*.6)*(1.+BT*.7+FL*.3);',
      '      }else{',
      '        float au=texture2D(AU,vec2(h21(floor(p.xz/2.))*.49,0.)).r;',
      '        col=mix(vec3(.1,.9,.05),vec3(.9,1.,.2),au)*(.8+BT*.6);',
      '        col=blinnPhong(n,rd,normalize(vec3(.3,1,.2)),col,.1);',
      '      }break;',
      '    }if(t>60.)break;t+=d;}',
      '  col+=vec3(.1,.6,.05)*.12*exp(-abs(rd.y)*4.)*(1.+B*.5);',
      '  float fog=1.-exp(-t*.012);col=mix(col,vec3(.0,.03,.01),fog);',
      '  vec2 fuv=feedUV(1.004,0.,vec2(0));',
      '  col=mix(texture2D(PV,fuv).rgb*.87,col,.28+BT*.06);',
      '  gl_FragColor=vec4(col,1.);',
      '}'
    ].join('\n')
  });

})();
