/**
 * v0.3.8-beta.6 — pure checkpoint-based transportation leg planning.
 * Read-only route projection. No Scene, Actor, Journal, time or currency writes.
 * Travel surfaces come from the same authored Road travel presets as Navigation.
 */
export const TRANSPORT_TRANSITION_SCHEMA=1;
const EPS=0.01;
const point=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
const near=(a,b,tolerance=EPS)=>point(a)&&point(b)&&
  Math.hypot(a.x-b.x,a.y-b.y)<=tolerance;
const routeSurface=(road,presets)=>{
  if(!road)return null;
  if(!road.travelPresetId)return "land";
  const surface=presets.get(road.travelPresetId)?.mode;
  return ["land","water","air"].includes(surface)?surface:null;
};

/** Require an authored checkpoint precisely at each change of travel surface. */
export function projectTransportationRouteLegs(route,atlas,travelPresets=[]){
  if(route?.status!=="ok"||!Array.isArray(route.legs)||route.legs.length>4096||
      !Array.isArray(atlas?.roads)||!Array.isArray(atlas?.nodes)||
      !Array.isArray(atlas?.checkpoints)||!Array.isArray(travelPresets))
    throw Error("A valid Atlas road route and checkpoint graph are required.");
  const roads=new Map(atlas.roads.map(road=>[road.id,road]));
  const presets=new Map(travelPresets.map(preset=>[preset.id,preset]));
  const nodes=new Map(atlas.nodes.map(node=>[node.id,node]));
  const checkpoints=atlas.checkpoints.map(cp=>({
    id:cp.id,name:cp.name,roadId:cp.roadId,
    position:nodes.get(cp.nodeId)
  })).filter(cp=>point(cp.position));
  const checkpointAt=(position,roadId)=>{
    const hits=checkpoints.filter(cp=>near(cp.position,position));
    return hits.find(cp=>cp.roadId===roadId)??hits[0]??null;
  };
  const legs=route.legs;
  const nextSurface=index=>{
    for(let n=index;n<legs.length;n++){
      if(legs[n].kind==="road")
        return routeSurface(roads.get(legs[n].roadId),presets);
    }
    return null;
  };
  const result=[];
  for(const [index,leg] of legs.entries()){
    if(!["road","off-road"].includes(leg.kind)||!Array.isArray(leg.points)||
      leg.points.length<2||!leg.points.every(point)||
      !Number.isFinite(leg.distance)||leg.distance<0)
      throw Error("Invalid road geometry in transportation itinerary.");
    const previous=result.at(-1);
    const surface=leg.kind==="road"?
      routeSurface(roads.get(leg.roadId),presets):
      (previous?.surface??nextSurface(index+1));
    if(!surface)throw Error("One of the roads has an unknown travel surface preset.");
    const start=leg.points[0],end=leg.points.at(-1);
    if(previous&&previous.surface===surface){
      previous.distance+=leg.distance;
      previous.weightedDistance+=Number.isFinite(leg.cost)?leg.cost:leg.distance;
      previous.lastRouteLeg=index;
      previous.end={x:end.x,y:end.y};
      if(leg.kind==="road"&&!previous.roadIds.includes(leg.roadId)){
        previous.roadIds.push(leg.roadId);
        previous.roadNames.push(roads.get(leg.roadId)?.name??"Road");
      }
    }else{
      const checkpoint=checkpointAt(start,leg.roadId);
      const transfer=previous?checkpointAt(start,previous.roadIds.at(-1))??checkpoint:null;
      if(previous){
        previous.arrivalCheckpoint=transfer?
          {id:transfer.id,name:transfer.name}:null;
        previous.transferValid=Boolean(transfer&&near(previous.end,start));
      }
      result.push({
        index:result.length,surface,
        firstRouteLeg:index,lastRouteLeg:index,
        start:{x:start.x,y:start.y},end:{x:end.x,y:end.y},
        distance:leg.distance,
        weightedDistance:Number.isFinite(leg.cost)?leg.cost:leg.distance,
        roadIds:leg.kind==="road"?[leg.roadId]:[],
        roadNames:leg.kind==="road"?[roads.get(leg.roadId)?.name??"Road"]:[],
        departureCheckpoint:transfer?
          {id:transfer.id,name:transfer.name}:checkpoint?
          {id:checkpoint.id,name:checkpoint.name}:null,
        arrivalCheckpoint:null,transferValid:true
      });
    }
  }
  // A final checkpoint may be the destination even when the surface stays fixed.
  const last=result.at(-1);
  if(last){
    const checkpoint=checkpointAt(last.end,last.roadIds.at(-1));
    if(checkpoint)last.arrivalCheckpoint={id:checkpoint.id,name:checkpoint.name};
  }
  return {schemaVersion:TRANSPORT_TRANSITION_SCHEMA,legs:result,
    hasTransitions:result.length>1,
    validTransfers:result.slice(0,-1).every(leg=>leg.transferValid)};
}

/** A leg is explicitly selected; only walking is a safe land default. */
export function transportationLegSelection(leg,selection){
  if(selection==null||selection==="")
    return leg.surface==="land"?{arrangement:"owned",methodId:"walking"}:null;
  if(typeof selection!=="string"||!/^(owned|hire)\|[a-zA-Z0-9_-]{1,128}$/.test(selection))
    throw Error("Invalid transportation leg selection.");
  const [arrangement,methodId]=selection.split("|");
  return {arrangement,methodId};
}

/** Human-readable planning narration, never a confirmation of payment/boarding. */
export function describeTransportationLeg(leg,{name,kind,surface,arrangement}={}){
  const label=String(name??"transport");
  const place=leg.departureCheckpoint?.name??"the departure point";
  const dest=leg.arrivalCheckpoint?.name??"the destination";
  const road=leg.roadNames.join(", ")||"the route";
  if(!name)return ["Select transportation for "+road+"."];
  if(kind==="foot"||surface==="land"&&label.toLowerCase().startsWith("walk"))
    return ["The party continues on foot along "+road+".",
      ...(leg.arrivalCheckpoint?["Reached "+dest+"."]:[])];
  const hire=arrangement==="hire";
  const embarking=surface==="water"||surface==="air";
  const vehicle=kind==="vehicle";
  const preamble=hire?
    (embarking?"The party booked passage aboard "+label+" at "+place+".":"Hired "+label+" at "+place+" to continue travel."):
    (embarking?"The party boarded their "+label+" at "+place+".":"The party set out using their "+label+" from "+place+".");
  const moving=embarking?
    (surface==="water"?"The party embarked aboard ":"The party departed aboard ")+
      label+" to travel along "+road+".":
    "Continued toward "+dest+" along "+road+".";
  const end=leg.arrivalCheckpoint?
    (embarking?(surface==="water"?"Disembarked at ":"Landed at ")+dest+".":"Reached "+dest+"."):null;
  return [preamble,moving,...(end?[end]:[])];
}
