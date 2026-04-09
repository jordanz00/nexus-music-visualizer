'use strict';
/*  energy.js — Energy / structure scenes.
    CRYSTAL CATHEDRAL, VORTEX ENGINE, PLASMA SPHERE,
    ALIEN MONOLITH, WARP CORE, CRYSTAL STORM.          */

(function () {
var H = NX.HEAD;

/* 1. VORTEX ENGINE — spinning stacked torus rings + central sphere */
NX.registerScene({n:'VORTEX ENGINE',rx:2,c:'#ff6d00',fs:H+[
'float map(vec3 p){',
'  float d=sdSph(p,.6+B*.2);',
'  for(int i=0;i<6;i++){',
'    float fi=float(i);vec3 q=p;q.y-=fi*.6-1.5;',
'    q.xz=rot2(T*(1.+fi*.3)+fi*1.047)*q.xz;',
'    d=min(d,sdTorus(q,1.5+fi*.2+M*.2,.06+BT*.04));',
'  }',
'  return d;',
'}',
'vec3 calcN(vec3 p){vec2 e=vec2(.001,0);return normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));}',
'void main(){',
'  vec2 sc=(uv-.5)*vec2(R.x/R.y,1.)*2.;',
'  float a=T*.4;vec3 ro=vec3(sin(a)*5.,2.+sin(T*.3),cos(a)*5.)+vec3(MX,0.);',
'  mat3 ca=camMat(ro,vec3(0.),0.);',
'  vec3 rd=ca*normalize(vec3(sc,2.));',
'  float td=0.;vec3 col=vec3(0.);',
'  for(int i=0;i<72;i++){',
'    vec3 p=ro+rd*td;float d=map(p);',
'    if(d<.001){',
'      vec3 n=calcN(p);',
'      col=blinnPhong(n,-rd,normalize(vec3(2.,3.,1.)),pal(length(p)*.2+PAL*.1),.08);',
'      col*=1.+FL*.3+BT*.5;',
'      col+=vec3(1.,.42,0.)*BT*.3/(1.+td);',
'      break;',
'    }',
'    if(td>30.)break;td+=d;',
'  }',
'  col+=vec3(1.,.42,0.)*exp(-length(sc)*2.)*.3*B;',
'  vec2 fUV=feedUV(1.01+B*.012,.002*SP,vec2(0.));',
'  col=mix(texture2D(PV,fUV).rgb*.9,col,.25+B*.12);',
'  gl_FragColor=vec4(pow(sat(col),vec3(.87)),1.);',
'}'
].join('\n')});

/* 3. PLASMA SPHERE — nested shells with surface ripples, energy arcs */
NX.registerScene({n:'PLASMA SPHERE',rx:2,c:'#1de9b6',fs:H+[
'float map(vec3 p){',
'  float r=length(p);',
'  float d=abs(r-2.-.3*sin(r*6.-T*3.)*B)-.05;',
'  d=min(d,abs(r-1.4-.2*sin(r*8.+T*4.)*M)-.04);',
'  d=min(d,abs(r-.7-.15*sin(r*10.-T*5.)*H)-.03);',
'  vec3 q=p;q.xy=rot2(T)*q.xy;',
'  float arc=sdTorus(q,2.5+sin(T*2.)*.5,.03+BT*.02);',
'  q=p;q.xz=rot2(T*1.3+1.)*q.xz;q.yz=rot2(.5)*q.yz;',
'  arc=min(arc,sdTorus(q,2.2+cos(T*1.7)*.4,.025));',
'  return min(d,arc);',
'}',
'vec3 calcN(vec3 p){vec2 e=vec2(.001,0);return normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));}',
'void main(){',
'  vec2 sc=(uv-.5)*vec2(R.x/R.y,1.)*2.;',
'  float a=T*.25;vec3 ro=vec3(sin(a)*6.,sin(T*.15)*2.,cos(a)*6.)+vec3(MX,0.);',
'  mat3 ca=camMat(ro,vec3(0.),0.);',
'  vec3 rd=ca*normalize(vec3(sc,1.8));',
'  float td=0.;vec3 col=vec3(0.);float glow=0.;',
'  for(int i=0;i<80;i++){',
'    vec3 p=ro+rd*td;float d=map(p);',
'    glow+=.015/(1.+d*d*40.);',
'    if(d<.001){',
'      vec3 n=calcN(p);',
'      col=blinnPhong(n,-rd,normalize(vec3(1.,2.,-1.)),pal(length(p)*.3+PAL*.2),.06);',
'      col*=1.+FL*.3+BT*.5;',
'      col+=pal(length(p)*.5+T*.2)*.3*(1.+BT);',
'      break;',
'    }',
'    if(td>25.)break;td+=d;',
'  }',
'  col+=vec3(.11,.91,.71)*glow*(1.+B);',
'  vec2 fUV=feedUV(1.01+B*.01,.002*SP,vec2(0.));',
'  col=mix(texture2D(PV,fUV).rgb*.9,col,.25+B*.12);',
'  gl_FragColor=vec4(pow(sat(col),vec3(.87)),1.);',
'}'
].join('\n')});

/* 4. ALIEN MONOLITH — tall obelisk with carved surface + orbiting orbs */
NX.registerScene({n:'ALIEN MONOLITH',rx:2,c:'#d500f9',fs:H+[
'float map(vec3 p){',
'  vec3 q=p;q.y-=3.;float taper=1.-.06*q.y;',
'  float ob=sdBox(q,vec3(.7*taper,4.,.35*taper));',
'  ob+=sin(q.y*8.+T)*sin(q.x*12.)*.02*M;',
'  ob+=sin(q.y*4.-T*2.)*.01;',
'  float d=min(ob,p.y+1.);',
'  for(int i=0;i<4;i++){',
'    float fi=float(i);float ang=T*.6+fi*1.5708;',
'    vec3 op=vec3(sin(ang)*2.5,2.+sin(T+fi)*1.5,cos(ang)*2.5);',
'    d=min(d,sdSph(p-op,.15+BT*.08));',
'  }',
'  return d;',
'}',
'vec3 calcN(vec3 p){vec2 e=vec2(.001,0);return normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));}',
'void main(){',
'  vec2 sc=(uv-.5)*vec2(R.x/R.y,1.)*2.;',
'  float a=T*.2;vec3 ro=vec3(sin(a)*7.,3.+sin(T*.15)+MX.y,cos(a)*7.)+vec3(MX.x,0.,0.);',
'  mat3 ca=camMat(ro,vec3(0.,3.,0.),0.);',
'  vec3 rd=ca*normalize(vec3(sc,2.));',
'  float td=0.;vec3 col=vec3(0.);float glow=0.;',
'  for(int i=0;i<72;i++){',
'    vec3 p=ro+rd*td;float d=map(p);',
'    for(int j=0;j<4;j++){float fj=float(j);float aj=T*.6+fj*1.5708;',
'      vec3 op=vec3(sin(aj)*2.5,2.+sin(T+fj)*1.5,cos(aj)*2.5);',
'      glow+=.01/(1.+length(p-op)*length(p-op)*8.);}',
'    if(d<.001){',
'      vec3 n=calcN(p);',
'      float gr=step(p.y,-.99);',
'      vec3 mc=mix(vec3(.15,.05,.2)+pal(p.y*.1+PAL*.1)*.4,vec3(.08),gr);',
'      col=blinnPhong(n,-rd,normalize(vec3(-1.,3.,2.)),mc,.05);',
'      break;',
'    }',
'    if(td>35.)break;td+=d;',
'  }',
'  col+=vec3(.83,0.,.98)*glow*(1.+B+BT);',
'  vec2 fUV=feedUV(1.01+B*.01,.001*SP,vec2(0.));',
'  col=mix(texture2D(PV,fUV).rgb*.91,col,.25+B*.12);',
'  gl_FragColor=vec4(pow(sat(col),vec3(.87)),1.);',
'}'
].join('\n')});

/* (WARP CORE and CRYSTAL STORM culled — too similar to VORTEX ENGINE / less distinctive) */

})();
