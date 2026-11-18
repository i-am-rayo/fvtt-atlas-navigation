/** Presentation adapter: publishes an already validated and formatted read
 * model. Never authorizes or records movement by rendering this page. */
export const JOURNEY_JOURNAL_PAGE="Atlas Journey Summary";

export async function publishJourneySummary(journal,html){
  if(!globalThis.game?.user?.isGM)
    throw Error("Only a GM may publish an Atlas Journey summary.");
  const page=[...(journal?.pages??[])].find(item=>
    item.name===JOURNEY_JOURNAL_PAGE);
  if(!page)return false;
  await journal.updateEmbeddedDocuments("JournalEntryPage",[
    {_id:page.id,"text.content":html}
  ]);
  return true;
}
