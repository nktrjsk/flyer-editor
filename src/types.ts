export type Palette = 'color' | 'bw'

export interface ConceptMeta {
  title: string
  org: string
  year: string
  web: string
  fontSize: number
  logo: string // base64 data URL or empty string
  palette: Palette
}

export const DEFAULT_META: ConceptMeta = {
  title: 'Znakový jazyk',
  org: 'Samostuduj',
  year: String(new Date().getFullYear()),
  web: '',
  fontSize: 9.5,
  logo: '',
  palette: 'color',
}

export const DEFAULT_MARKDOWN = `## Co to je?

Znakový jazyk (někdy „znakovka") určitě není ~~„znaková řeč"~~ — „řeč" je
zvukový projev, zatímco znakový jazyk je vizuálně‑motorický: používá ruce,
mimiku, pohyby těla a prostor kolem nás.

Znakový jazyk je **plnohodnotný jazyk** — má vlastní slovní zásobu i gramatiku
a dá se jím vyjádřit všechno: otázky, přání, vtipy, emoce i abstraktní témata.
Není to pantomima ani „mávaní rukama" — význam vzniká podle ustálených znaků
a pravidel.

## Kdy se hodí?

V situacích, kdy mluvení nejde nebo by bylo nepříjemné:

- v hlučném prostředí (koncert, bar, dílna)
- tam, kde je potřeba být potichu (knihovna, zkouška, někdo telefonuje nebo spí)
- přes sklo, ve vodě, z větší vzdálenosti
- při dočasně omezené možnosti mluvit — po zákroku, s rouškou, při ztrátě hlasu
- při komunikaci s neslyšícími

*Pojmy jako „hluchoněmý" se dnes obvykle nepoužívají — většina neslyšících
není němá, jen používá jiný komunikační kanál.*

---

## Pro koho je znakový jazyk?

Často se vnímá jako „jazyk neslyšících" — a ano, pro mnoho Neslyšících
(s velkým N jako kulturní a jazyková komunita) je to přirozený mateřský jazyk.
Zároveň ale může být užitečný úplně každému, kdo se chce domluvit i bez hlasu.

## Nemusíš být plynný/á, aby to dávalo smysl

Už pár základních znaků a ochota se domluvit umí výrazně usnadnit běžné situace:

> pozdrav · poděkování · prosba · „nerozumím" · „zopakuj" · „počkej" ·
> „pojď" · „promiň" · „pomoc" · „kde?" · „kolik?"

## Co znakový jazyk obsahuje?

- **Znaky** — ustálená „slova" tvořená tvarem ruky, místem, pohybem a mimikou
- **Prstová abeceda** — hláskování; používá se hlavně pro jména, názvy,
  zkratky nebo slova bez běžného znaku

## Znakový jazyk není univerzální

Různé země mají různé znakové jazyky. V České republice se používá **český
znakový jazyk** — není to „čeština do rukou", ale jazyk s vlastním způsobem
vyjadřování.`
