# Wedding song tagging — billy-fm → conor.bio

## The approach

Two columns:

- **`wedding_rank`** INTEGER — drives sort order. 1 = most requested at weddings right now. NULL = not a wedding song.
- **`wedding_moment`** TEXT — `ceremony` / `cocktail` / `dinner` / `first_dance` / `parent_dance` / `party`. Renders as a chip; useful as a secondary filter later.

The "popular at weddings" checkbox filters on `wedding_rank IS NOT NULL` and sorts by `wedding_rank ASC`. First screen becomes Perfect, Die With a Smile, All of Me, At Last — not "A Case of You."

**Ranking is banded, not absolute.** Ranks 1–40 are individually ordered because those are what a bride scans for. Everything below sits in a band of 100, 200, or 300 and falls back to alphabetical within it. Nobody can meaningfully rank song #97 against #98, and pretending otherwise makes the list impossible to maintain.

| Band | Meaning |
|---|---|
| 1–40 | The canon. Individually ranked. |
| 100 | Strong and current — commonly requested |
| 200 | Solid working repertoire |
| 300 | Fits a wedding, rarely requested by name |
| NULL | Not a wedding song |

**Worth stating plainly:** the top 40 is my judgment of what's dominating first-dance and processional lists heading into 2027, not chart data. Revisit in February. The 2024–25 entries still climbing — Die With a Smile, Birds of a Feather — will either consolidate or fade, and you'll know which by then.

---

# CLAUDE CODE PROMPT

Copy from here down.

---

Add wedding song tagging and ranking to the songs table in billy-fm, and wire it into the existing "popular at weddings" filter on the song list.

**Read the existing schema, worker routes, and song list component first.** Report what you find and flag anything below that conflicts with current conventions. D1 database behind `billy-fm-worker.conorthaxter.workers.dev`.

## 1. Migration

```sql
ALTER TABLE songs ADD COLUMN wedding_rank INTEGER DEFAULT NULL;
ALTER TABLE songs ADD COLUMN wedding_moment TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_songs_wedding_rank ON songs(wedding_rank);
```

`wedding_rank IS NOT NULL` means it's a wedding song. `wedding_moment` is one of: `ceremony`, `cocktail`, `dinner`, `first_dance`, `parent_dance`, `party`.

## 2. Sort behaviour

When the wedding filter is on:

```sql
SELECT * FROM songs
WHERE wedding_rank IS NOT NULL
ORDER BY wedding_rank ASC, title ASC;
```

Ties within a band resolve alphabetically. When the filter is off, keep the current default sort.

## 3. Ambiguous titles

Match on `title`; where noted, match on `title` AND `artist`:

- **Smile** → Nat King Cole only
- **Emotions** → Destiny's Child only
- **Mine** → Taylor Swift only
- **On The Street Where You Live** → the My Fair Lady Cast row
- **Imagine** → neither; skip both
- **Creep** → neither
- **A Thousand Miles** and **Thousand Miles** are duplicate rows for the same song. Tag both identically and flag for manual cleanup.

## 4. Reporting

Use `--file`, not `--command`. After running, output the count per band and per moment, plus any titles from the lists below that matched zero rows. DB spelling is inconsistent ("Billie Joel", "Whitney Houson", "Joni MItchell", "Tammi Terelle") — report misses rather than guessing.

## 5. UI

- Keep the existing "popular at weddings" checkbox. It now filters and re-sorts as above.
- Add a small moment chip to each row when the filter is active.
- Live count: "190 wedding songs".
- Search works within the active filter.
- Empty state: "No match — request it in your quote and I'll learn it."
- Mobile: stack title over artist, moment as a chip. Never shrink a table to fit.
- Mobile-first, 8px spacing scale, tap targets ≥44px, 16px minimum font on inputs.
- No localStorage or sessionStorage. Match the existing billy-fm visual language.

Stop after reading the schema and confirm the approach before building.

---

# THE TOP 40

Individually ranked. This is the first screen a bride sees.

| # | Song | Moment |
|---|---|---|
| 1 | Perfect | first_dance |
| 2 | Die With a Smile | first_dance |
| 3 | All of Me | first_dance |
| 4 | At Last | first_dance |
| 5 | Thinking Out Loud | first_dance |
| 6 | Birds of a Feather | ceremony |
| 7 | Make You Feel My Love | first_dance |
| 8 | Tennessee Whiskey | first_dance |
| 9 | Best Part | first_dance |
| 10 | Songbird | ceremony |
| 11 | Beyond | ceremony |
| 12 | Halo | first_dance |
| 13 | Love on Top | party |
| 14 | Say a Little Prayer | ceremony |
| 15 | Get You | first_dance |
| 16 | Snooze | first_dance |
| 17 | Isn't She Lovely | parent_dance |
| 18 | Signed, Sealed, Delivered | party |
| 19 | God Only Knows | ceremony |
| 20 | Your Song | ceremony |
| 21 | Harvest Moon | ceremony |
| 22 | Into the Mystic | ceremony |
| 23 | Boo'd Up | first_dance |
| 24 | If I Ain't Got You | first_dance |
| 25 | Ordinary People | first_dance |
| 26 | Let's Stay Together | first_dance |
| 27 | Growing Old With You | ceremony |
| 28 | She's Always a Woman | parent_dance |
| 29 | The Way You Look Tonight | ceremony |
| 30 | Landslide | parent_dance |
| 31 | Yellow | ceremony |
| 32 | Lovely Day | cocktail |
| 33 | Danny's Song | parent_dance |
| 34 | September | party |
| 35 | Dancing Queen | party |
| 36 | I Wanna Dance With Somebody | party |
| 37 | Sweet Caroline | party |
| 38 | You Make My Dreams Come True | party |
| 39 | Real Love Baby | ceremony |
| 40 | Save Me The Trouble | first_dance |

---

# BAND 100 — strong and current

```
Ain't No Mountain High Enough    party
Ascension                        first_dance
Bed Peace                        first_dance
Cater 2 U                        first_dance
Cruisin                          first_dance
Daughters                        parent_dance
Dream a Little Dream of Me       ceremony
Espresso                         party
Fly Me to the Moon               cocktail
Folded                           first_dance
For Once in My Life              cocktail
Gravity                          first_dance
Hey There Delilah                first_dance
Home                             first_dance
I Don't Wanna Miss a Thing       first_dance
In My Life                       ceremony
Iris                             first_dance
Is This Love                     first_dance
Kiss Me More                     cocktail
Levitating                       party
Locked out of Heaven             party
Mine                             first_dance
Moondance                        ceremony
More Than Words                  first_dance
My Girl                          parent_dance
Only 1                           first_dance
Put Your Records On              cocktail
Some Kind of Wonderful           parent_dance
Something In Between             first_dance
Stand by Me                      cocktail
Stay                             first_dance
Sway                             ceremony
That's What I Like               party
Time After Time                  first_dance
To Know Him is to Love Him       first_dance
Valerie                          cocktail
What a Wonderful World           ceremony
What You Won't Do for Love       first_dance
You and I                        first_dance
```

# BAND 200 — solid working repertoire

```
A Case of You                    ceremony
All I Want                       ceremony
All My Lovin                     party
American Boy                     party
Bennie and the Jets              party
Beyond the Sea                   cocktail
Bleeding Love                    first_dance
Blinding Lights                  party
Build Me Up Buttercup            party
Crazy In Love                    party
Crazy Little Thing Called Love   party
Cupid                            cocktail
Daisies                          party
Dancing in the Moonlight         party
Diamonds                         party
Distance                         first_dance
Don't Stop Believing             party
Don't Stop Me Now                party
Dreams                           cocktail
Emotions                         first_dance
Get Lucky                        party
Girl on Fire                     party
Heaven                           first_dance
Hey Jude                         party
How Deep Is Your Love            party
I'll Be                          first_dance
Killing me Softly                cocktail
Last Dance                       party
Let's Get it On                  dinner
Love Shack                       party
Many Times                       first_dance
Misty                            dinner
Mr. Brightside                   party
Murder on the Dancefloor         party
My Way                           dinner
New York State of Mind           dinner
New York, New York               dinner
Night and Day                    dinner
One Dance                        party
Our Song                         party
Piano Man                        dinner
Ring of Fire                     party
Sitting on the Dock of the Bay   cocktail
Smile                            cocktail
Stayin Alive                     party
Sunday Morning                   cocktail
Superstition                     party
Sweet Home Alabama               party
Take me Home Country Roads       party
Take on Me                       party
Teenage Dream                    party
That's Life                      dinner
The Dress                        first_dance
Time of Your Life                dinner
Twist and Shout                  party
Umbrella                         party
Unwritten                        party
Vienna                           parent_dance
Wide Open Spaces                 parent_dance
Wonderwall                       cocktail
You Belong WIth Me               party
You Make Me Feel Like Dancing    party
You Make Me Feel So Young        parent_dance
You Send Me                      cocktail
```

# BAND 300 — fits, rarely requested by name

```
A Thousand Miles                 party
Any Way You Want It              party
Bad Romance                      party
Beautiful                        dinner
Bewitched Bothered And Bewildered  dinner
Blank Space                      party
Blue Suede Shoes                 party
Break Free                       party
Bye Bye Bye!                     party
Crazy He Calls Me                dinner
Dancing in the Dark              party
Don't Let Me Down                party
Everybody Wants to Rule the World  cocktail
Georgia                          cocktail
Heart of Glass                   party
Hey Ya                           party
High Horse                       party
Hit Me Baby, One More Time       party
Hound Dog                        party
I Will Survive                   party
In My Feelings                   party
Intentions                       party
Jailhouse Rock                   party
Just What I Needed               party
Kiss                             party
Let's Do It (Let's Fall in Love) dinner
Moonlight in Vermont             dinner
My Life Would Suck WIthout You   party
Nights Like This                 cocktail
No Tears Left to Cry             party
On The Street Where You Live     dinner
Party in the USA                 party
Peaches                          party
Pennies from Heaven              dinner
Poker Face                       party
Rhiannon                         cocktail
Sex on Fire                      party
Someday                          cocktail
Summer Wind                      dinner
Survivor                         party
That's Amore                     dinner
The Man Who Can't Be Moved       cocktail
Thousand Miles                   party
Toxic                            party
Use Somebody                     party
Video Games                      cocktail
We Found Love                    party
```

---

# DO NOT TAG

Requested by people who only know the chorus. Most are about infidelity, grief, or a relationship ending. Leaving them out is a small piece of expertise a planner notices.

| Song | Why |
|---|---|
| Someone Like You | Watching an ex marry someone else |
| I Can't Make You Love Me | Unrequited, the night before leaving |
| Jolene | Begging a woman not to take your man |
| Before He Cheats | Vandalising a cheater's truck |
| Say My Name | Catching a partner cheating |
| Slow Dancing in a Burning Room | Explicitly a relationship ending |
| Dancing on My Own | Watching your love with someone else |
| Flowers | Post-divorce self-reliance |
| The Weekend | Being the other woman |
| Best Thing I Never Had | Relief at dodging a bad ex |
| Love Yourself | Kiss-off |
| Thank U, Next | Affectionate, but a list of exes |
| NASA | Needing space from a partner |
| Irreplaceable | Throwing his things out |
| Me, Myself, and I | Breakup |
| Fast Car | Beautiful, bittersweet, ends badly |
| Yesterday | Grief |
| Ain't No Sunshine | Absence |
| Candle in the Wind | Funeral association |
| What Was I Made For | Existential |
| Good Luck Babe! | Someone denying their feelings |
| Need You Now | Drunk-dialling an ex |
| Go Your Own Way | Breakup |
| Hello | Apology to an ex |
| When We Were Young | Nostalgia for what's gone |
| This Love | Breakup |
| Doo-Wop (That Thing) | Warning about men |
| Maneater | Warning about a woman |
| Nobody Gets Me | Loss |
| We Can't Be Friends | Breakup |

**Judgment call:** Mr. Brightside and Hey Ya are lyrically about betrayal and are tagged `party` anyway, because nobody at a reception is listening to the words. Pull them if that bothers you.

---

# COUNTS

| Band | Songs |
|---|---|
| 1–40 | 40 |
| 100 | 39 |
| 200 | 64 |
| 300 | 47 |
| **Total tagged** | **190** |

---

# GAPS TO FILL BEFORE AUG 12

Missing from the library and requested at almost every wedding. The first is the most-requested processional there is, and a planner will notice its absence.

1. **Can't Help Falling in Love** — Elvis
2. **A Thousand Years** — Christina Perri
3. **Marry You** — Bruno Mars
4. **Here Comes the Sun** — Beatles
5. **Just the Way You Are** — Billy Joel
6. **L-O-V-E** — Nat King Cole
7. **Uptown Funk**
8. **Brown Eyed Girl**
9. **You Are the Sunshine of My Life** — Stevie Wonder

Learn 1–5 if there's time before the shoot. All five would land in the top 20.
