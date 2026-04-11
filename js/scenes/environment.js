'use strict';
/*  environment.js — Environment / world scenes.
    NEON GRID, NEBULA FLYTHROUGH (STARSHIP BRIDGE culled)           */

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

  /* ---------------------------------------------------------------
     2. NEBULA FLYTHROUGH  (#ff6d00)
     Volumetric nebula — ray march through fbm density field,
     scatter/emission via pal(), star background, beat flash.
  --------------------------------------------------------------- */
  NX.registerScene({
    n: 'NEBULA FLYTHROUGH', c: '#ff6d00',
    fs: H + [
      'void main(){',
      '  vec2 st=(gl_FragCoord.xy-.5*R)/R.y;',
      '  vec3 ro=vec3(0,0,T*.4*SP);',
      '  mat3 cm=camMat(ro,ro+vec3(MX*.3,1.),sin(T*.03)*.02);',
      '  vec3 rd=cm*normalize(vec3(st,1.5));',
      '  vec3 col=vec3(0.);float acc=0.;',
      '  for(int i=0;i<76;i++){',
      '    vec3 p=ro+rd*float(i)*.15;',
      '    float dens=fbm((p.xz+p.y*vec2(3.7,1.3))*.4+T*.04)-.42+B*.12;',
      '    if(dens>0.){',
      '      float d=dens*.08;',
      '      vec3 em=pal(dens*2.5+p.z*.03+T*.005)*d*3.;',
      '      em+=vec3(1.,.4,.05)*d*sat(dens-.1)*2.;',
      '      em*=1.+BT*.9+FL*.35;',
      '      col+=em*(1.-acc);acc+=d*(1.-acc);',
      '      if(acc>.95)break;',
      '    }',
      '  }',
      '  vec2 sg=floor(st*100.);',
      '  float star=step(.985,h21(sg))*h21(sg+99.)*(1.-acc);',
      '  col+=vec3(1.,.95,.85)*star*.8;',
      '  col+=vec3(1.,.35,.05)*BT*.12;',
      '  vec2 fuv=feedUV(1.008,.001,vec2(0,-.002));',
      '  col=mix(texture2D(PV,fuv).rgb*.88,col,.32+BT*.08);',
      '  gl_FragColor=vec4(col,1.);',
      '}'
    ].join('\n')
  });

})();
