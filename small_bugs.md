# Small bugs

This is a list to keep track of very small bugs that could be fixed later in a unified patch.

## Wrong cursor position when in header

When the cursor is a hash, the cursor is positioned in the hash itself, which causes confusion, the cursor should appear next to the hash.

- Write a hash
- the cursor renders IN the hash which looks weird.

## Strange cursor positioning after writing first inline equation

When writing the first and only the first math equation, and closing it, the cursor will appear inside the equation for a moment, only for it to appear right next to it (where it should be) after less than a second.

## Display math still needs three dollar signs

Display equations should work with two dollar signs on open and close, but currently two dollar signs often get converted into inline math.

- Write `$$equation$$`
- It converts to inline instead of display
- Using `$$$equation$$$` makes it display, then closing can convert it back to `$$` 