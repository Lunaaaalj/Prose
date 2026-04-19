# Small bugs

This is a list to keep track of small bugs that could be fixed later in a consolidated patch.

## Wrong cursor position when in header

When the cursor is a hash, the cursor is positioned in the hash itself, which causes confusion, the cursor should appear next to the hash.

- Write a hash
- the cursor renders IN the hash which looks weird.

## Strange cursor positioning after writing first inline equation

When writing the first and only the first math equation, and closing it, the cursor will appear inside the equation for a moment, only for it to appear right next to it (where it should be) after a second.

## `$$…$$` mid-paragraph falls back to inline math

Block math detection is anchored to the whole paragraph (`BLOCK_MATH_RE = /^\$\$(?!\$)([\s\S]+?)\$\$$/`), so `$$x$$` only converts to display when it's the entire paragraph. When surrounding text is present, block detection misses it and the inline pass picks up the `$…$` interior, producing empty inline-math wrappers around the content.

- Write `some text $$equation$$ more text` on one line
- Instead of a display block, you get inline math around the interior (`$` pairs matched greedily)
- Workaround: `$$$equation$$$` sometimes survives the inline pass, but closing can collapse back to `$$`

Related: see "Display math only works with inline `$$`" below — same anchored-regex limitation, different facet.

## Display math only works with inline `$$`

Display math won't work if the equation is written in the form

```tex
$$
\implies S=\lim_{ n \to \infty } \sum_{i=1}^N|| \frac{\vec{r}(t_{i}+\Delta t_{i})-\vec{r}(t_{i})}{\Delta t_{i}}||\Delta t_{i}
$$
```

Instead, it will only render for

```tex
$$\implies S=\lim_{ n \to \infty } \sum_{i=1}^N|| \frac{\vec{r}(t_{i}+\Delta t_{i})-\vec{r}(t_{i})}{\Delta t_{i}}||\Delta t_{i}$$
```


## Pasting text with math 

When a Markdown text that contains math is pasted the resulting text does not have the `$` for the math equations. For example:

Copying

```tex
$$
\implies S=\lim_{ n \to \infty } \sum_{i=1}^N|| \frac{\vec{r}(t_{i}+\Delta t_{i})-\vec{r}(t_{i})}{\Delta t_{i}}||\Delta t_{i}
$$
```

then pasting into Prose, results in

```plain
\implies S=\lim_{ n \to \infty } \sum_{i=1}^N|| \frac{\vec{r}(t_{i}+\Delta t_{i})-\vec{r}(t_{i})}{\Delta t_{i}}||\Delta t_{i}
```

which renders unusable the ability to copy and paste math equations.