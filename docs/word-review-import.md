# IELTS 单词复习导入说明

这套实现和 `pte` 的单词复习结构保持一致，分成 4 层：

1. `vocabulary_words`
   存全局词条，一条单词只保留一份基础信息。

2. `word_review_deck_words`
   把单词映射到具体 deck，并保存排序和频次分数。

3. `user_wordbook_entries`
   用户手动收藏的单词本。

4. `user_word_review_progress` / `user_word_review_word_progress`
   保存用户在某个 deck 的整体进度，以及每个单词的掌握状态。

## JSON 输入格式

导入脚本 `scripts/import-word-review-json.mjs` 接收这样的 JSON：

```json
{
  "decks": [
    {
      "code": "ielts_core_6",
      "words": [
        {
          "word": "abandon",
          "phonetic": "əˈbændən",
          "partOfSpeech": "v.",
          "definition": "to leave something completely",
          "translation": "放弃；遗弃",
          "exampleSentence": "Many farmers had to abandon the land.",
          "audioUrl": null,
          "level": "intermediate",
          "source": "cambridge-ielts-core",
          "frequencyScore": 98.6
        }
      ]
    }
  ]
}
```

## 字段如何映射到数据库

`word` -> `vocabulary_words.word`

`phonetic` -> `vocabulary_words.phonetic`

`partOfSpeech` -> `vocabulary_words.part_of_speech`

`definition` -> `vocabulary_words.definition`

`translation` -> `vocabulary_words.translation`

`exampleSentence` -> `vocabulary_words.example_sentence`

`audioUrl` -> `vocabulary_words.audio_url`

`level` -> `vocabulary_words.level`

`source` -> `vocabulary_words.source`

`frequencyScore` -> `word_review_deck_words.frequency_score`

`decks[].code` -> `word_review_deck_words.deck_code`

同一个 `word` 会先 upsert 到 `vocabulary_words`，然后再插入对应的 deck 映射，所以一份单词可以复用到多个 deck。

## 从原始单词文档转换时的建议

如果你的原始文档是纯文本、表格或 OCR 结果，先整理成下面这个中间结构：

```json
{
  "code": "ielts_topic_environment",
  "words": [
    {
      "word": "biodiversity",
      "phonetic": "ˌbaɪəʊdaɪˈvɜːsəti",
      "partOfSpeech": "n.",
      "definition": "the variety of plant and animal life in a place",
      "translation": "生物多样性",
      "exampleSentence": "Protecting biodiversity is a global priority."
    }
  ]
}
```

再把多个 deck 合并成顶层 `decks` 数组即可。

## 执行导入

```bash
npm run import:word-review -- --input data/word-review.sample.json --local
```

远程 D1：

```bash
npm run import:word-review -- --input data/word-review.sample.json --remote
```

## 支持你现在这类原始文本

下面这种文本现在也可以直接解析：

```txt
location  /ləuˈkeɪʃn/  n. 位置，场所；（电影的）外景拍摄地
breakdown /ˈbreɪkdaun/ n. 垮台，倒塌，破裂；（健康、精神等）衰竭，衰弱；（机器等的）损坏，故障；分类
irresistible /ˏɪrɪˈzɪstəbl/ a. 无法抵抗的，不能压制的；不能自己的
fluency   [ˈflu:ənsi]  n. 流利，流畅；通顺
```

解析规则是：

`单词` + `音标` + `词性` + `中文释义`

其中：

`/音标/` 和 `[音标]` 都支持。

词性目前支持 `n.`、`v.`、`a.`、`ad.`，也支持 `n./vt.`、`vt./n.`、`a./ad.` 这类复合形式。

中文释义会同时写入 `definition` 和 `translation`，这样和 `pte` 现有导入方式保持一致。

先把文本转成标准 JSON：

```bash
npm run import:word-review -- --input data/word-review.sample.txt --format text --deck-code ielts_core_6 --dump-json
```

直接导入本地 D1：

```bash
npm run import:word-review -- --input data/word-review.sample.txt --format text --deck-code ielts_core_6 --local
```

对应的示例原文文件：

[word-review.sample.txt](/Users/rico/Desktop/ielts/data/word-review.sample.txt)
