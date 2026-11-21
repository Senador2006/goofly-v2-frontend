(() => {
  const host = document.querySelector('.pilot .bot');
  const hero = document.querySelector('#hero');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const T = window.THREE;
  if (!host || !T) return;
  let renderer;
  try {
    renderer = new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  } catch { return; }
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden','true');
  renderer.setClearColor(0,0);
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(-2,2,2,-2,.1,30);
  camera.position.set(0,2.58,9);
  camera.lookAt(0,1.83,0);

  // A small virtual studio gives the visor, metal joints and gold trim distinct reflections.
  const studio = new T.Scene();
  studio.background = new T.Color(0x535b60);
  function softbox(x,y,z,w,h,intensity) {
    const panel = new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({
      color:new T.Color(intensity,intensity,intensity),side:T.DoubleSide
    }));
    panel.position.set(x,y,z); panel.lookAt(0,1,0); studio.add(panel);
  }
  softbox(-4,5,3,2.5,5,5); softbox(4,3,1,1.1,4,3); softbox(0,5,-3,5,2,4);
  const pmrem = new T.PMREMGenerator(renderer);
  const env = pmrem.fromScene(studio,.035);
  scene.environment = env.texture; pmrem.dispose();
  studio.traverse(o => {if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
  scene.add(new T.HemisphereLight(0xf2faff,0x797361,1.1));
  const key = new T.DirectionalLight(0xfff4de,2.5);
  key.position.set(-4,6,4);scene.add(key);
  const rim = new T.DirectionalLight(0xb7eaff,2.0);
  rim.position.set(4,3,-3);scene.add(rim);

  function finish(color,metalness,roughness) {
    return new T.MeshStandardMaterial({color,metalness,roughness});
  }
  const pearl=finish(0xf2f0e8,.44,.28), silver=finish(0xa4afb5,.8,.23);
  const carbon=finish(0x161c23,.48,.37), rubber=finish(0x15171a,.08,.63);
  const visor=finish(0x080d13,.64,.13), navy=finish(0x111925,.24,.4);
  const brim=finish(0x111418,.56,.21), gold=finish(0xffb20b,.57,.22);
  const light=new T.MeshBasicMaterial({color:0xffdf36,toneMapped:false});
  const group=(parent,x=0,y=0,z=0)=>{
    const g=new T.Group();g.position.set(x,y,z);parent.add(g);return g;
  };
  function mesh(parent,geometry,material,x=0,y=0,z=0){
    const m=new T.Mesh(geometry,material);m.position.set(x,y,z);parent.add(m);return m;
  }
  const ballGeo=new T.SphereGeometry(1,40,28);
  function oval(parent,x,y,z,rx,ry,rz,material){
    const m=mesh(parent,ballGeo,material,x,y,z);m.scale.set(rx,ry,rz);return m;
  }
  function link(parent,a,b,r1,r2,material){
    const start=new T.Vector3(...a),end=new T.Vector3(...b),v=end.clone().sub(start);
    const m=mesh(parent,new T.CylinderGeometry(r2,r1,v.length(),32),material);
    m.position.copy(start).lerp(end,.5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return m;
  }
  function curve(parent,points,radius,material){
    return mesh(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),24,radius,8,false),material);
  }
  function ringProfile(parent,profile,mat,x,y,z,depth=1){
    const geo=new T.LatheGeometry(profile.map(p=>new T.Vector2(...p)),64);
    const m=mesh(parent,geo,mat,x,y,z);m.scale.z=depth;return m;
  }
  function casing(parent,x,y,z,w,h,d,exp,mat){
    const geo=ballGeo.clone(),p=geo.attributes.position;
    const power=n=>Math.sign(n)*Math.pow(Math.abs(n),exp);
    for(let i=0;i<p.count;i++)p.setXYZ(i,w*power(p.getX(i)),h*power(p.getY(i)),d*power(p.getZ(i)));
    geo.computeVertexNormals();return mesh(parent,geo,mat,x,y,z);
  }
  const body=group(scene);
  body.rotation.y=-.095;
  // Seated pose, with separate rubber outsoles and raised tread.
  for(const side of [-1,1]){
    const x=side*.42;
    oval(body,x,.62,.05,.32,.38,.33,carbon);
    oval(body,x,.64,.25,.36,.31,.39,pearl);
    const boot=group(body,x,.34,.48);boot.rotation.x=-.22;boot.rotation.z=side*-.15;
    oval(boot,0,0,0,.34,.34,.42,pearl);
    oval(boot,0,0,.12,.35,.33,.34,gold);
    oval(boot,0,-.015,.23,.347,.337,.245,rubber);
    for(let j=-2;j<=2;j++){
      const y=j*.095,span=.24*(1-Math.abs(j)*.12);
      const soleDepth=(x,h)=>.236+.245*Math.sqrt(Math.max(0,1-(x/.347)**2-((h+.015)/.337)**2));
      const tread=[-span,-span/2,0,span/2,span].map(x=>{const h=y-.035+.048*Math.abs(x/span);return [x,h,soleDepth(x,h)];});
      curve(boot,tread,.012,carbon);
    }
  }
  oval(body,0,.78,0,.53,.32,.36,carbon);
  ringProfile(body,[[.03,-.49],[.34,-.45],[.48,-.32],[.52,.14],[.47,.4],[.32,.46],[.01,.46]],pearl,0,1.33,0,.78);
  link(body,[0,1.68,0],[0,1.91,0],.25,.26,carbon);
  // Compass set into the front of the breastplate.
  const badge=group(body,0,1.39,.395);
  oval(badge,0,0,0,.222,.222,.048,silver);
  oval(badge,0,0,.038,.187,.187,.032,visor);
  function needle(rot,color){
    const shape=new T.Shape();shape.moveTo(0,.156);shape.lineTo(.034,0);shape.lineTo(0,-.035);shape.lineTo(-.031,0);shape.closePath();
    mesh(badge,new T.ShapeGeometry(shape),new T.MeshBasicMaterial({color}),0,0,.073).rotation.z=rot;
  }
  for(let i=0;i<4;i++)needle(.27+i*Math.PI/2,i===0?0xe35039:0xe5e6df);
  oval(body,.30,1.59,.32,.07,.033,.018,gold);

  const neck=group(body,0,1.85,0);
  casing(neck,0,.57,0,.98,.76,.68,.78,pearl);
  casing(neck,0,.60,.195,.89,.65,.559,.72,carbon);
  casing(neck,0,.60,.235,.856,.615,.55,.70,visor);
  for(const side of [-1,1]){
    oval(neck,side*.937,.60,-.014,.106,.325,.274,carbon);
    oval(neck,side*.994,.60,-.01,.091,.276,.234,gold);
    oval(neck,side*1.035,.60,.002,.058,.20,.16,pearl);
  }
  const face=group(neck,0,.60,.773);
  const gaze=group(face);
  const eyes=[-.335,.335].map(x=>oval(gaze,x,.068,-.006,.117,.143,.035,light));
  curve(face,[[-.112,-.123,.018],[-.062,-.165,.026],[0,-.174,.029],[.065,-.161,.024],[.115,-.112,.014]],.018,light);

  // Peaked pilot cap: fabric crown, band, curved lacquered bill and a winged badge.
  const cap=group(neck,0,1.10,-.008);cap.rotation.z=.095;cap.rotation.x=-.09;
  ringProfile(cap,[[.02,0],[.70,0],[.83,.075],[.92,.22],[.93,.28],[.86,.37],[.64,.46],[.29,.495],[.01,.5]],navy,0,0,0,.82);
  ringProfile(cap,[[.79,.006],[.82,.045],[.845,.125]],brim,0,-.012,.012,.83);
  oval(cap,0,.014,.47,.785,.061,.49,brim);
  curve(cap,[[-.70,.108,.413],[-.41,.113,.635],[0,.115,.728],[.41,.113,.635],[.70,.108,.413]],.022,gold);
  const insignia=group(cap,0,.273,.775);
  oval(insignia,0,0,.01,.068,.065,.018,gold);
  for(const side of [-1,1]){
    for(let i=0;i<3;i++){
      const feather=oval(insignia,side*(.104-i*.009),.005-i*.022,0,.084-i*.016,.014,.016,gold);
      feather.rotation.z=side*(.30+i*.08);
    }
  }
  // Salute is part of the stationary body rig.
  for(const side of [-1,1]){
    const up=side===-1;
    const shoulder=[side*.49,1.58,0], elbow=up?[-.96,1.75,.19]:[.79,1.15,.02];
    const wrist=up?[-.98,2.21,.46]:[.94,.81,.24];
    oval(body,...shoulder,.186,.19,.17,carbon);
    link(body,shoulder,elbow,.135,.14,carbon);
    oval(body,...elbow,.161,.163,.15,silver);
    link(body,elbow,wrist,.151,.169,pearl);
    const bandStart=wrist.map((n,i)=>n+(elbow[i]-n)*.15);
    link(body,bandStart,wrist,.173,.173,gold);
    const hand=group(body,...wrist);
    hand.rotation.z=up?-.40:.12;
    const dir=up?1:-1;
    oval(hand,0,dir*.10,.03,.135,.165,.098,rubber);
    for(let i=0;i<4;i++){
      const offset=(i-1.5)*.061;
      const finger=oval(hand,offset,dir*(.216+.026*Math.cos(offset*15)),.060,.039,.095,.046,carbon);
      finger.rotation.z=up?-.14:0;
    }
    oval(hand,side*-.12,.07*dir,.07,.059,.09,.053,rubber).rotation.z=side*.55;
  }

  host.append(canvas);
  let frame=0,visible=false,paused=false,last=0,elapsed=0;
  let yaw=0,pitch=0,gazeX=0,gazeY=0;
  let blinkAt=3.65;
  function draw(now){
    frame=0;if(!visible || document.hidden || paused)return;
    const dt=last?Math.min((now-last)/1000,.05):0;last=now;elapsed+=dt;
    const calm=reducedMotion.matches;
    const ease=(current,target,speed)=>current+(target-current)*(-Math.expm1(-speed*dt));
    yaw=calm?0:ease(yaw,pilotLook.x*.40,6.7);
    pitch=calm?0:ease(pitch,pilotLook.y*.20,6.3);
    gazeX=calm?0:ease(gazeX,pilotLook.x*.077,14);
    gazeY=calm?0:ease(gazeY,-pilotLook.y*.039,14);
    const idle=calm?0:Math.sin(elapsed*1.28)*.008;
    neck.rotation.set(pitch+idle,yaw,-yaw*.10);
    gaze.position.set(gazeX,gazeY,0);
    const age=elapsed-blinkAt;
    const blink=!calm && age>=0 && age<.23?Math.sin(Math.PI*age/.23)**2:0;
    if(age>.23)blinkAt=elapsed+3.3+Math.random()*2.4;
    eyes.forEach(e=>e.scale.y=.143*(1-.88*blink));
    renderer.render(scene,camera);
    host.classList.add('has-model');
    if(!calm)requestDraw();
  }
  function requestDraw(){if(!frame && visible && !document.hidden && !paused)frame=requestAnimationFrame(draw);}
  new ResizeObserver(()=>{
    const {width,height}=host.getBoundingClientRect();
    if(!width||!height)return;
    renderer.setSize(width,height,false);
    const half=1.925;
    camera.top=half;camera.bottom=-half;
    camera.left=-half*width/height;camera.right=-camera.left;
    camera.updateProjectionMatrix();requestDraw();
  }).observe(host);
  new IntersectionObserver(([e])=>{visible=e.isIntersecting;last=0;requestDraw();}).observe(host);
  document.addEventListener('visibilitychange',()=>{last=0;requestDraw();});
  reducedMotion.addEventListener('change',requestDraw);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;host.classList.remove('has-model');});
  canvas.addEventListener('webglcontextrestored',()=>{paused=false;last=0;requestDraw();});
})();
