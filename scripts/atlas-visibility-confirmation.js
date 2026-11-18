/** GM-only manual reveal/hide confirmation. This presentation helper never saves. */
const messages={
  road:{
    show:"Players may see this Road's line and permitted label. Its Map Markers and Journal access remain separate.",
    hide:"Players will no longer see this Road overlay. Its Map Markers and Journal permissions do not change."
  },
  marker:{
    show:"Players may see this Map Marker, subject to existing discovery and Fog rules. Roads and Journal access remain separate.",
    hide:"Players will no longer see this Map Marker through its direct visibility setting. Discovery and Journal permissions remain separate."
  },
  discovery:{
    show:"The party will know this Map Marker through lore. Its discovery settings may reveal nearby terrain; Journal permissions do not change.",
    hide:"The party will no longer know this Map Marker. Previously explored terrain is not automatically hidden again."
  },
  territory:{
    show:"Players may display this native Territory boundary in Atlas Layers, including potentially unexplored areas. Its public Journey name is published separately.",
    hide:"The Territory boundary will no longer be shared in Atlas Layers. Its separately published Journey name remains unchanged."
  }
};
const titles={road:"Road",marker:"Map Marker",discovery:"Map Marker",territory:"Territory Boundary"};

export async function confirmAtlasVisibilityChange({kind,name,show,staged=false}){
  if(!messages[kind]||typeof name!=="string"||typeof show!=="boolean")
    throw Error("Invalid Atlas visibility confirmation.");
  const title=titles[kind],verb=kind==="territory"?(show?"Share":"Hide"):(show?"Show":"Hide");
  const content=document.createElement("div");
  for(const line of [
    (show?"Show ":"Hide ")+title+" “"+name+"” "+(kind==="territory"?"to":"from")+" players?",
    messages[kind][show?"show":"hide"],
    staged?"This changes only the current draft. Save to apply it, or Cancel to discard.": 
      "This takes effect only after the existing save checks succeed. Hiding graphics is not data confidentiality."
  ]){
    const paragraph=document.createElement("p");
    paragraph.textContent=line;
    content.appendChild(paragraph);
  }
  return await foundry.applications.api.DialogV2.confirm({
    window:{title:verb+" "+title},content,
    yes:{label:verb+" "+title},no:{label:"Cancel"},rejectClose:false,modal:true
  })===true;
}
