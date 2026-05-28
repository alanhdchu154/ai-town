export function stripStageDirectionsFromDialogue(line: string) {
  const withoutParentheticals = line.replace(/（[^）]{1,100}）|\([^)]{1,100}\)/g, '');
  const quotedSpeech = quotedSpeechFromThirdPersonNarration(withoutParentheticals);
  if (quotedSpeech) {
    return {
      line: quotedSpeech,
      strippedStageDirection: true,
    };
  }
  const normalizedThirdPerson = firstPersonFromUnquotedThirdPersonSelfNarration(withoutParentheticals);
  const source = normalizedThirdPerson || withoutParentheticals;
  const clauses = source.split(/(?<=[，,。！？!?；;])/);
  let strippedStageDirection = withoutParentheticals !== line || Boolean(normalizedThirdPerson);
  const kept = clauses.filter((clause) => {
    if (!clause.trim()) return false;
    if (!isStageDirectionClause(clause)) return true;
    strippedStageDirection = true;
    return false;
  });
  const cleaned = kept.join('').replace(/^[，,。！？!?；;\s]+/g, '').trim();
  return {
    line: cleaned,
    strippedStageDirection,
  };
}

export function stripSeparatorArtifacts(line: string) {
  return line
    .split(/\r?\n/)
    .filter((part) => !/^[\-*_=]{3,}$/.test(part.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function hasThirdPersonSelfNarrationLeak(line: string) {
  return Boolean(
    quotedSpeechFromThirdPersonNarration(line) ||
      firstPersonFromUnquotedThirdPersonSelfNarration(line) ||
      knownCharacterStageDirectionClause(line),
  );
}

export function hasDialogueSystemPhraseLeak(line: string) {
  return /世界情緒的脈絡|世界情緒脈絡|情緒脈絡|世界脈絡|世界協調報告|世界協調|校園情緒地圖(?:的)?報告|校園情緒地圖|把你也捲進那些混亂|捲進那些混亂裡|conversation state|conversationOutcome|主線/.test(
    line,
  );
}

function isStageDirectionClause(clause: string) {
  const trimmed = clause
    .trim()
    .replace(/^["'「『“”]+|["'」』“”]+$/g, '')
    .replace(/[，,。！？!?；;\s]+$/g, '');
  const withoutLeadIn = trimmed
    .replace(/^(?:好|嗯|行|可以|是啊)[，,、\s]*(?:那)?/g, '')
    .replace(/^那(?=我)/g, '');
  if (!withoutLeadIn) return false;
  return (
    /^(?:我)(?:輕輕|慢慢|先|再|又|剛|剛剛|剛才|剛才只是|默默|順手|得去)?(?:合上|放下|看向|走到|靠回|拿起|起身|伸手|握住|推開|按住|移開|坐下|站起|轉身|低頭|抬頭|停下|停住|靠近|退開|盯著|把手機|把[^，,。！？!?；;]{0,18}(?:放下|轉過去|拿起|推開|按住|移開|合上|收起|遞過去|蓋好|劃掉|圈掉|收進|放進|推到))/.test(
      withoutLeadIn,
    ) ||
    /^看(?:你|妳|著|向)/.test(withoutLeadIn) ||
    knownCharacterStageDirectionClause(withoutLeadIn) ||
    /^(?:顯得|看起來|看上去).{0,80}(?:緊張|疲憊|疲倦|沉默|不安|焦慮|心事|重重|兮兮|猶豫|尷尬|低落)/.test(
      withoutLeadIn,
    ) ||
    /^(?:這時|此時|那時|這時候|此刻)(?![^，,。！？!?；;]*(?:我|你|妳|咱))(?=.{0,80}(?:正在|牆|窗|門|桌|椅|杯|筆電|手機|小貓|貓|打量|好奇|走|坐|站|靠|看著))/.test(
      withoutLeadIn,
    )
  );
}

function knownCharacterStageDirectionClause(line: string) {
  const trimmed = line.trim();
  return /^(?:海|真晝|明日奈|麻衣|曹操|劉備|Umi|Mahiru|Mahiru Shiina|Asuna|Mai|CaoCao|Liu Bei)\s*(?:靜悄悄|悄悄|默默|有些|略微|剛才)?(?:看起來|顯得|坐在|站在|看著|看向|望著|盯著|避開|保持沉默|低頭|抬頭|停下|停住|走到|靠近|拿著|放下|把|對|看)(?=.{0,180}(?:[，,。！？!?；;]|$))/.test(
    trimmed,
  );
}

function quotedSpeechFromThirdPersonNarration(line: string) {
  const trimmed = line.trim();
  const match = trimmed.match(
    /^(?:海|真晝|明日奈|麻衣|曹操|劉備|Umi|Mahiru|Mahiru Shiina|Asuna|Mai|CaoCao|Liu Bei)\s*(?:看著|看向|望著|走到|靠近|拿著|放下|低頭|抬頭|停下|坐在|站在|把|對)[^「」]{0,120}(?:(?:問|說|提醒|回答|開口)[：:]|[，,])\s*「([^」]{1,240})」[。.!！?？]*$/,
  );
  return match?.[1]?.trim() ?? '';
}

function firstPersonFromUnquotedThirdPersonSelfNarration(line: string) {
  const trimmed = line.trim();
  const match = trimmed.match(
    /^(?:海|真晝|明日奈|麻衣|曹操|劉備|Umi|Mahiru|Mahiru Shiina|Asuna|Mai|CaoCao|Liu Bei)\s*(注意到|覺得|感覺|想起|知道|聽見|看見|看到)(.{2,260})$/,
  );
  if (!match) return undefined;
  return `我${match[1]}${match[2]}`.trim();
}
