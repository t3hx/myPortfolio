// intro-scene.jsx — Intro « Triangle » : L'idée / La conception / La réalisation
// Pensé pour un portage three.js + GSAP :
//   OM_SCENES            <-> labels d'une timeline GSAP master (beats = tl.add(..., 'label+=x'))
//   MOTION               <-> eases GSAP : enter = power4.out, draw = sine.inOut, pop = back.out
//   camA() / worldB      <-> le rig caméra three.js (dolly + zoom) — un seul objet animé
//   novaPos / swirlPos   <-> positions d'un THREE.Points (BufferAttribute) recalculées par frame
// TOUT est fonction pure de T (temps signé) : aucun état intégré -> scrub/seek trivial.

const { CompositionStage, useComposition, Easing, animate, clamp,
        useTweaks, TweaksPanel, TweakSection, TweakToggle, TweakRadio, TweakColor } = window;

const W = 1920, H = 1080, CX = 960, CY = 540, NAME_Y = CY - 60;
const INK = '#04050c', CREAM = '#EFE5D3';
// Géométrie de la favicon (boîte 32, pointe en bas) — src/ui/Logo.tsx / public/favicon.svg
const TRI_D = 'M6 7H26L16 26Z';
const TRI_SIDES = ['M6 7H26', 'M26 7L16 26', 'M16 26L6 7']; // haut / droite / gauche
const SUB = 5; // sous-groupes de tracé par lot du plan

function rng32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const lerp=(a,b,u)=>a+(b-a)*u;

// Les 3 helpers de mouvement (discipline cue-first) — ne rien easer en dehors.
const MOTION = {
  enter:(from,to,start,end)=>animate({from,to,start,end,ease:Easing.easeOutQuart}),
  draw :(from,to,start,end)=>animate({from,to,start,end,ease:Easing.easeInOutSine}),
  pop  :(from,to,start,end)=>animate({from,to,start,end,ease:Easing.easeOutBack}),
};

// ---- données seedées (déterministes -> export vidéo stable)
const STARS = (()=>{ const r=rng32(7); const gs=[];
  const mk=n=>{let d='';for(let i=0;i<n;i++){d+=`M${(-500+r()*2920).toFixed(1)} ${(-350+r()*1780).toFixed(1)}h.01`;}return d;};
  for(let g=0;g<3;g++) gs.push({d:mk(58),w:2.2,f:0.9+g*0.35,ph:g*2.1,base:0.5});
  for(let g=0;g<3;g++) gs.push({d:mk(24),w:3.4,f:0.7+g*0.3,ph:1+g*1.7,base:0.8});
  return gs;})();

const PMAX = 900;
const PARTS = (()=>{ const r=rng32(31); const a=[];
  for(let i=0;i<PMAX;i++) a.push({
    ang:r()*Math.PI*2, spd:0.3+r()*0.95, cls:i%10<6?0:(i%10<9?1:2),
    f:0.4+r()*1.2, ph:r()*6.28, delay:r()*1.45, dur:1.6+r()*0.8, rad:700+r()*520,
  });
  return a;})();

// Cibles texte : pixels échantillonnés du nom (statique, calculé une fois la fonte prête)
function useTextTargets(){
  const [pts,setPts]=React.useState(null);
  React.useEffect(()=>{ let on=true;
    const load = document.fonts && document.fonts.load ? document.fonts.load('96px Michroma','THIBAULT DUBOIS') : Promise.resolve();
    load.then(()=>{ if(!on) return;
      const c=document.createElement('canvas'); c.width=1700; c.height=220;
      const g=c.getContext('2d',{willReadFrequently:true});
      g.font='96px Michroma'; try{g.letterSpacing='6px';}catch(e){}
      g.textAlign='center'; g.textBaseline='middle'; g.fillStyle='#fff';
      g.fillText('THIBAULT DUBOIS',850,110);
      const img=g.getImageData(0,0,1700,220).data; const out=[];
      for(let y=2;y<220;y+=6) for(let x=2;x<1700;x+=6)
        if(img[(y*1700+x)*4+3]>120) out.push([x-850+CX,y-110+NAME_Y]);
      setPts(out);
    });
    return ()=>{on=false;};
  },[]);
  return pts;
}

// Triangle contours — strokes en px constants (divisés par l'échelle locale)
function Tri({x,y,size,rot,lit,glow=1,opacity=1,accent,weight=1}){
  if(opacity<=0.004||size<=0.2) return null;
  const s=size/19;
  const base=2.2*weight/s, w0=16*weight/s, w1=9*weight/s, w2=4.2*weight/s, w3=1.8*weight/s;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s}) translate(-16 -13.33)`} opacity={opacity}>
      <path d={TRI_D} fill="none" stroke={accent} strokeOpacity="0.4" strokeWidth={base} strokeLinejoin="round"></path>
      {lit.map(i=>(
        <g key={i}>
          <path d={TRI_SIDES[i]} fill="none" stroke={accent} strokeWidth={w0} strokeLinecap="round" strokeOpacity={Math.min(0.18,0.07*glow)}></path>
          <path d={TRI_SIDES[i]} fill="none" stroke={accent} strokeWidth={w1} strokeLinecap="round" strokeOpacity={Math.min(0.4,0.14*glow)}></path>
          <path d={TRI_SIDES[i]} fill="none" stroke={accent} strokeWidth={w2} strokeLinecap="round" strokeOpacity={Math.min(0.7,0.32*glow)}></path>
          <path d={TRI_SIDES[i]} fill="none" stroke="#EAFBFF" strokeWidth={w3} strokeLinecap="round" strokeOpacity={Math.min(1,0.85*glow)}></path>
        </g>
      ))}
    </g>);
}

// Le plan du lab : 2274 tracés memoïsés ; le dessin est piloté par variables CSS
// posées sur le conteneur (une par lot x sous-groupe), donc 0 re-render par frame.
const LabSvg = React.memo(function LabSvg({accent}){
  const LAB=window.LAB_ART;
  if(!LAB) return null;
  return (
    <g transform="translate(0 15)">
      {LAB.order.map(k=>(
        <g key={k}>
          {LAB.batches[k].map((pw,i)=>(
            <path key={i} d={pw[0]} fill="none" stroke={accent} strokeWidth={pw[1]} strokeLinecap="round"
              pathLength="1" strokeDasharray="1 1" style={{strokeDashoffset:`var(--p${k}${i%SUB})`}}></path>
          ))}
        </g>
      ))}
    </g>);
});

// Mot de phase : discret, lettre par lettre, disparaît en fin de phase
function PhaseWord({word,x,y,align,start,end,T,accent}){
  const gone=1-MOTION.draw(0,1,end,end+0.6)(T);
  if(T<start-0.1||gone<=0.004) return null;
  return (
    <div style={{position:'absolute',left:x,top:y,width:460,textAlign:align,opacity:gone,fontSize:19,fontWeight:500,
      letterSpacing:'0.62em',color:accent,fontFamily:"'Space Grotesk',sans-serif",textShadow:`0 0 12px ${accent}55`}}>
      {word.split('').map((ch,i)=>(
        <span key={i} style={{opacity:MOTION.enter(0,0.85,start+i*0.09,start+i*0.09+0.2)(T)}}>{ch}</span>
      ))}
    </div>);
}

function Piece({accent,density}){
  const {T,CUES}=useComposition();
  const t0=CUES['Idée'], t1=CUES['Conception'], t2=CUES['Réalisation'];
  const targets=useTextTargets();
  const N=Math.min(PMAX,density);

  // ---- beats (offsets relatifs aux cues -> retiming host sans casse)
  const tArr=t0+1.2, tSuck=t0+3.55, tExpl=t0+5.35;
  const tPlunge=t1+2.3, tDrawS=t1+3.0;
  const tSwirl=t2+0.05, tText=t2+2.35, tTri3=t2+2.9, tEtch=t2+3.9;

  // ---- monde A : espace (caméra = translate+scale autour du point visé)
  const c2x=CX-620+14*Math.sin(T*0.31), c2y=CY-250+10*Math.cos(T*0.23);
  const panU=MOTION.draw(0,1,t1+0.15,tPlunge)(T);
  const plungeU=clamp((T-tPlunge)/1.5,0,1);
  const preZoom=1+0.05*MOTION.draw(0,1,t0,t1)(T);
  const fx=lerp(CX,c2x,panU), fy=lerp(CY,c2y,panU);
  const sA=T<tPlunge?lerp(preZoom,2.2,panU):2.2*Math.pow(16/2.2,Math.pow(plungeU,2.2));
  const aOp=1-MOTION.draw(0,1,tPlunge+1.05,tPlunge+1.55)(T);
  const showA=T<tPlunge+1.6;

  // triangle 1 : arrivée théâtrale -> anticipation -> succion
  const arrScale=MOTION.enter(6.2,1.55,tArr,tArr+2.2)(T);
  const arrRot=MOTION.pop(-160,0,tArr,tArr+2.4)(T);
  const arrOp=MOTION.enter(0,1,tArr,tArr+0.9)(T);
  const antic=MOTION.pop(0,0.09,tSuck-0.35,tSuck+0.05)(T);
  const suckU=clamp((T-tSuck)/1.75,0,1);
  const shrink=Math.pow(suckU,1.9);
  const tri1Scale=arrScale*(1+antic)*(1-0.988*shrink);
  const tri1Rot=arrRot+980*Math.pow(suckU,2.6);
  const tri1Op=arrOp*clamp((tExpl-T)/0.06,0,1);
  const tri1Glow=1+2.2*suckU;
  const coreR=30*Math.pow(suckU,1.6);
  const coreOp=clamp((suckU-0.25)/0.5,0,1)*clamp((tExpl+0.05-T)/0.1,0,1);

  // triangle 2 : dérive au loin, deux côtés en emphase
  const tri2Op=MOTION.draw(0,1,t1+0.5,t1+1.5)(T);

  // nova : burst décéléré + errance (fonction pure de T)
  const novaActive=showA&&T>=tExpl-0.02;
  let novaD=['','',''];
  if(novaActive){
    const u=clamp((T-tExpl)/6.2,0,1), e=1-Math.pow(1-u,4);
    for(let i=0;i<N;i++){const p=PARTS[i];
      const r_=p.spd*1020*e, wob=26*u*Math.sin(T*p.f+p.ph);
      const x=CX+Math.cos(p.ang)*r_+Math.cos(p.ang+1.57)*wob;
      const y=CY+Math.sin(p.ang)*r_*0.94+Math.sin(p.ang+1.57)*wob;
      novaD[p.cls]+=`M${x.toFixed(1)} ${y.toFixed(1)}h.01`;}
  }
  const novaOp=MOTION.enter(0,0.95,tExpl,tExpl+0.18)(T);
  const ringR=MOTION.enter(30,910,tExpl,tExpl+1.5)(T);
  const ringU=clamp((T-tExpl)/1.5,0,1);
  const ring2R=MOTION.enter(20,520,tExpl,tExpl+2.3)(T);
  const ring2U=clamp((T-tExpl)/2.3,0,1);

  // flash du big-bang (espace écran)
  const flashOp=Math.min(MOTION.enter(0,1,tExpl-0.08,tExpl+0.06)(T),MOTION.draw(1,0,tExpl+0.06,tExpl+0.6)(T))*0.95;

  // ---- monde B : intérieur du triangle (le lab) — surgit pendant la plongée
  const sB=MOTION.draw(0.07,1,tPlunge+0.55,tPlunge+1.85)(T)*(1+0.02*clamp((T-t2)/7,0,1));
  const bOp=MOTION.draw(0,1,tPlunge+0.7,tPlunge+1.35)(T);
  const showB=T>tPlunge+0.5;

  // variables CSS du dessin : 11 lots (H2..CA) x 5 sous-groupes
  const labVars={};
  const LAB=window.LAB_ART;
  if(LAB){LAB.order.forEach((k,ki)=>{for(let j=0;j<SUB;j++){
    const st=tDrawS+ki*0.26+j*0.06;
    labVars['--p'+k+j]=String(1-MOTION.draw(0,1,st,st+0.72)(T));}});}
  const labOp=1-0.68*MOTION.draw(0,1,t2+1.6,t2+3.1)(T);

  // tourbillon -> lettres
  const swirlOpG=MOTION.enter(0,0.95,tSwirl,tSwirl+0.5)(T)*(1-MOTION.draw(0,1,t2+2.5,t2+3.3)(T));
  const swirlActive=T>=tSwirl-0.02&&swirlOpG>0.004&&targets&&targets.length>0;
  let swirlD=['','',''];
  if(swirlActive){
    for(let i=0;i<N;i++){const p=PARTS[i];
      const tgt=targets[Math.floor(i*targets.length/N)];
      const u=clamp((T-tSwirl-p.delay)/p.dur,0,1);
      const e=0.5-0.5*Math.cos(Math.PI*u);
      const r_=p.rad*(1-e), ang=p.ang+4.3*e;
      const x=tgt[0]+Math.cos(ang)*r_, y=tgt[1]+Math.sin(ang)*r_*0.9;
      swirlD[p.cls]+=`M${x.toFixed(1)} ${y.toFixed(1)}h.01`;}
  }

  // nom en vraies lettres
  const name='THIBAULT DUBOIS';
  // triangle 3 : arc de cercle, tête en bas, derrière le nom / devant le plan
  const aU=MOTION.draw(0,1,tTri3,tTri3+2.3)(T);
  const th=lerp(-215,-90,aU)*Math.PI/180;
  const rr=MOTION.enter(760,0,tTri3,tTri3+2.3)(T);
  const tri3Op=MOTION.draw(0,0.92,tTri3,tTri3+0.8)(T);
  // une fois posé derrière le nom, le triangle s'assombrit pour laisser la vedette au texte
  const tri3Dim=MOTION.draw(0,1,tTri3+2.3,tTri3+3.4)(T);

  // clignotement « lumière défaillante » du mot CREATIVE (boucle CSS, survit au gel final)
  const flickOn=T>tEtch+1.85;

  // titre gravé au laser
  const eU=MOTION.draw(0,1,tEtch,tEtch+1.7)(T);
  const sparkOn=eU>0.001&&eU<0.999;

  return (
    <div data-screen-label={`t=${Math.floor(T)}s`} style={{position:'relative',width:W,height:H,overflow:'hidden',background:INK,fontFamily:"'Space Grotesk',sans-serif"}}>
      {/* MONDE A — l'espace (caméra en transform SVG vectoriel : coût de peinture constant) */}
      <div style={{position:'absolute',left:0,top:0,width:W,height:H,display:showA?'block':'none',opacity:aOp}}>
        <svg width={W} height={H} style={{position:'absolute',left:0,top:0,overflow:'visible'}}>
          <g transform={`translate(${CX-fx*sA} ${CY-fy*sA}) scale(${sA})`}>
          {STARS.map((g,gi)=>(
            <path key={gi} d={g.d} stroke={CREAM} strokeWidth={g.w} strokeLinecap="round" fill="none"
              opacity={MOTION.enter(0,1,t0+gi*0.22,t0+1.5+gi*0.22)(T)*g.base*(0.62+0.38*Math.sin(T*g.f+g.ph))}></path>
          ))}
          {ringU>0&&ringU<1&&<circle cx={CX} cy={CY} r={ringR} fill="none" stroke={accent} strokeWidth={0.5+5*(1-ringU)} opacity={0.55*(1-ringU)}></circle>}
          {ring2U>0&&ring2U<1&&<circle cx={CX} cy={CY} r={ring2R} fill="none" stroke={accent} strokeWidth={0.5+2.5*(1-ring2U)} opacity={0.25*(1-ring2U)}></circle>}
          {coreOp>0&&<g opacity={coreOp}>
            <circle cx={CX} cy={CY} r={coreR*2.6} fill={accent} opacity="0.18"></circle>
            <circle cx={CX} cy={CY} r={coreR} fill="#EAFBFF"></circle>
          </g>}
          <Tri x={CX} y={CY} size={420*tri1Scale/1.55} rot={tri1Rot} lit={[0]} glow={tri1Glow} opacity={tri1Op} accent={accent}></Tri>
          <Tri x={c2x} y={c2y} size={120} rot={12*Math.sin(T*0.21)} lit={[0,1]} glow={1.1} opacity={tri2Op} accent={accent}></Tri>
          {novaActive&&<g opacity={novaOp}>
            <path d={novaD[0]} stroke={accent} strokeWidth="3.2" strokeLinecap="round" fill="none"></path>
            <path d={novaD[1]} stroke={accent} strokeWidth="4.8" strokeLinecap="round" fill="none" opacity="0.9"></path>
            <path d={novaD[2]} stroke="#EAFBFF" strokeWidth="7" strokeLinecap="round" fill="none" opacity="0.95"></path>
          </g>}
          </g>
        </svg>
      </div>

      {/* MONDE B — l'intérieur du triangle : le plan, puis l'identité */}
      <div style={Object.assign({position:'absolute',left:0,top:0,width:W,height:H,display:showB?'block':'none',opacity:bOp},labVars)}>
        <svg width={W} height={H} style={{position:'absolute',left:0,top:0,overflow:'visible'}}>
          <g transform={`translate(${CX-CX*sB} ${CY-CY*sB}) scale(${sB})`}>
            <path d={STARS[0].d} stroke={CREAM} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.14"></path>
            <g opacity={labOp}>
              <LabSvg accent={accent}></LabSvg>
            </g>
            <Tri x={CX+Math.cos(th)*rr} y={NAME_Y+14+Math.sin(th)*rr} size={lerp(240,470,aU)} rot={lerp(-80,0,aU)}
              lit={[0,1,2]} glow={lerp(2.2,1.15,tri3Dim)} weight={1.8} opacity={tri3Op*(1-0.48*tri3Dim)} accent={accent}></Tri>
            {swirlActive&&<g opacity={swirlOpG}>
              <path d={swirlD[0]} stroke={accent} strokeWidth="3" strokeLinecap="round" fill="none"></path>
              <path d={swirlD[1]} stroke={accent} strokeWidth="4.4" strokeLinecap="round" fill="none" opacity="0.9"></path>
              <path d={swirlD[2]} stroke="#EAFBFF" strokeWidth="6.4" strokeLinecap="round" fill="none" opacity="0.95"></path>
            </g>}
          </g>
        </svg>
        <div style={{position:'absolute',inset:0,transform:`translate(${CX-CX*sB}px, ${CY-CY*sB}px) scale(${sB})`,transformOrigin:'0 0',willChange:'transform'}}>
        <div style={{position:'absolute',left:0,top:NAME_Y-58,width:W,height:116,lineHeight:'116px',textAlign:'center',
          fontFamily:"'Michroma',sans-serif",fontSize:96,letterSpacing:'6px',color:CREAM,whiteSpace:'pre'}}>
          {name.split('').map((ch,i)=>{
            const o=MOTION.draw(0,1,tText+i*0.045,tText+0.55+i*0.045)(T);
            return <span key={i} style={{opacity:o,textShadow:`0 0 26px ${accent}59, 0 0 7px ${accent}a6`,
              display:'inline-block',transform:`translateY(${(1-o)*12}px)`}}>{ch}</span>;
          })}
        </div>
        <div style={{position:'absolute',left:CX-290,top:NAME_Y+72,width:580,height:40}}>
          <div style={{width:'100%',textAlign:'center',fontSize:24,fontWeight:500,letterSpacing:'0.52em',color:'#C9D4D8',
            textShadow:`0 0 14px ${accent}40`,clipPath:`inset(-10px ${(1-eU)*100}% -10px 0)`,paddingLeft:'0.52em'}}>
            <span style={flickOn?{animation:'omFlicker 2.7s steps(1,end) infinite'}:null}>CREATIVE</span> DEVELOPER</div>
            {sparkOn&&<div style={{position:'absolute',left:eU*580-3,top:-4,width:6,height:38,background:'#EAFBFF',
              borderRadius:3,opacity:0.75+0.25*Math.sin(T*42),boxShadow:`0 0 18px 6px ${accent}, 0 0 46px 18px ${accent}66`}}></div>}
          </div>
        </div>
      </div>

      {/* FX écran */}
      {flashOp>0.004&&<div style={{position:'absolute',inset:0,opacity:flashOp,
        background:`radial-gradient(circle at 50% 50%, #ffffff 0%, ${accent} 22%, transparent 62%)`}}></div>}
      <div style={{position:'absolute',inset:0,pointerEvents:'none',
        background:'radial-gradient(ellipse at center, transparent 52%, rgba(0,0,3,0.55) 100%)'}}></div>
      <PhaseWord word="GENESIS" x={150} y={168} align="left" start={t0+2.2} end={t0+4.9} T={T} accent={accent}></PhaseWord>
      <PhaseWord word="INCUBATION" x={W-610} y={H-186} align="right" start={t1+3.8} end={t2-0.35} T={T} accent={accent}></PhaseWord>
      <PhaseWord word="EMERGENCE" x={W-610} y={152} align="right" start={t2+0.5} end={t2+5.1} T={T} accent={accent}></PhaseWord>
    </div>);
}

function IntroApp(){
  const [tw,setTweak]=useTweaks(window.TWEAK_DEFAULTS);
  return (
    <div style={{width:'100%',height:'100%',minHeight:'100vh',background:INK,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <CompositionStage width={W} height={H} scenes={window.OM_SCENES} playback={window.OM_PLAYBACK} bg={INK}>
        <Piece accent={tw.accent} density={parseInt(tw.density,10)||650}></Piece>
      </CompositionStage>
      <TweaksPanel>
        <TweakSection label="Animation"></TweakSection>
        <TweakToggle label="Motion editor" value={tw.motionEditor} onChange={v=>setTweak('motionEditor',v)}></TweakToggle>
        <TweakRadio label="Particules" value={tw.density} options={['400','650','900']} onChange={v=>setTweak('density',v)}></TweakRadio>
        <TweakSection label="Couleur"></TweakSection>
        <TweakColor label="Accent" value={tw.accent} options={['#8FDBE4','#00C0E8','#BFF7FF']} onChange={v=>setTweak('accent',v)}></TweakColor>
      </TweaksPanel>
    </div>);
}
window.IntroApp=IntroApp;
