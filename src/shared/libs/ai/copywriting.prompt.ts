// Guia de copywriting compartilhado pelos prompts que escrevem texto de anúncio (roteiro e copy do vídeo).
export const COPYWRITING_GUIDE = `Guia de copywriting:
- O vídeo tem 12 segundos e o texto aparece sobre a foto do produto. Quem assiste lê cada frase em um ou dois segundos, então cada palavra precisa trabalhar.
- Headline: um gancho que faça a pessoa parar de rolar a tela. Prefira o benefício principal ou a sensação que o produto entrega ("Chocolate que derrete na boca") ao nome do produto, que já aparece na tela. Seja concreto e específico; frases genéricas como "Qualidade que você merece" não prendem atenção.
- Bullets: cada um traz um benefício diferente, do mais forte para o mais fraco. Quando partir de uma característica dos dados, diga o que ela faz pela pessoa, sem acrescentar fatos novos (se os dados dizem "tecido de algodão", escreva "Algodão leve para o dia todo", não só "Tecido de algodão"). Mantenha a mesma estrutura gramatical entre os bullets e não repita a ideia da headline.
- CTA: comece com um verbo no imperativo e convide para uma ação simples ("Peça o seu", "Experimente hoje"). Não use urgência falsa como "Últimas unidades" ou "Só hoje".
- Linguagem: português do Brasil coloquial e claro, frases curtas e voz ativa. Use palavras sensoriais quando combinarem com o produto (sabor, textura, aroma, toque). Evite clichês e exageros ("incrível", "revolucionário", "o melhor do mercado"), porque soam como anúncio genérico e reduzem a confiança.
- Se os dados trouxerem o nome da marca, a copy deve soar como essa marca falando com o cliente, sem repetir o nome dela em todas as frases.
- Se o briefing trouxer voiceTone, escreva nesse tom. Se trouxer targetAudience, escolha os benefícios que mais importam para esse público. Se trouxer copyGuidelines, siga essas orientações; elas valem mais que as preferências de estilo deste guia, mas não que as regras abaixo.`;

// Regras que nenhum texto de anúncio pode quebrar. O preço e a imagem vêm do cadastro, nunca da IA.
export const COPYWRITING_RULES = `Regras:
- Use somente informações presentes nos dados do produto. Se os dados forem escassos, escreva benefícios genéricos e verdadeiros sobre o tipo de produto, sem inventar características.
- Nunca mencione preço, valores, moeda, desconto, porcentagem, frete, parcelamento, prazo de entrega, garantia, estoque ou especificações técnicas que não estejam nos dados. O preço é exibido separadamente pelo sistema.
- Sem emojis, hashtags ou aspas.`;
