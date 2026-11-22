# Tiny Wins

Four small games in one place. Play them in your browser - nothing to install.

| Game | What you do |
|------|-------------|
| **Chess** | Two players on one screen, with all the real rules (check, checkmate, castling, en passant, promotion, draws). |
| **Catch Stars** | Help Boo catch 20 falling stars. Miss 3 and it's over. Arrow keys, or drag with your mouse / finger. |
| **Flower Memory** | Flip cards and find the matching pairs of flowers. Mouse clicks. |
| **Puzzle** | Slide the tiles to put the picture back together. |

## Players and scoreboard

When the page opens it asks for a **name** and a **password or PIN** (4-12 characters). Each game then
saves your results to the **Scoreboard**: Chess (wins/draws/losses), Catch Stars (best score), Flower Memory
and Puzzle (fewest moves, best time).

- Scores are saved in the browser on **each device**. Friends on other phones/computers have their own boards.
- The password is only a simple lock (stored scrambled, never sent anywhere). Clearing browser data erases the scores.
- In Chess you are White; pick Black from the list (Guest or another player on the same device).

## Play online

After you turn on GitHub Pages (steps below), the game is at:

`https://YOUR-USERNAME.github.io/TinyWins/`

## Put it on GitHub (so friends can open a link)

1. Make a free account at https://github.com and click **New repository**.
   Name it `TinyWins` and choose **Public**.
2. On the new repository page click **uploading an existing file**, then drag in
   **everything from this folder**: `index.html`, `style.css`, `puzzle.png`, `README.md`
   and the whole `js` folder. Click **Commit changes**.
   - `index.html` must be at the top level of the repository (not inside another folder).
   - File names are case-sensitive on GitHub: keep `puzzle.png` in lowercase.
3. Go to **Settings -> Pages**. Under **Build and deployment**, choose
   **Deploy from a branch**, pick the branch `main` and the folder `/ (root)`, then press **Save**.
4. Wait about a minute and refresh the Pages screen. It shows your link.
   Send that link to your friends.

To change the game later, edit the files on GitHub (or upload new ones). The link updates by itself.

## Run it on your own computer

Just open `index.html` in a browser. (If the puzzle picture does not show, start a small
local server instead: open a terminal in this folder and run `python -m http.server`,
then visit http://localhost:8000.)

## What is in the folder

```
index.html          the page (menu + one box for each game)
style.css           colours and layout (strawberry milkshake theme)
puzzle.png          the picture for the Puzzle game (replace it with any picture you like)
js/main.js          small helpers shared by all games (pop-up boxes, timer text)
js/players.js       players, password check and saved scores
js/login.js         sign-in screen, player bar, scoreboard screen
js/start.js         the menu: opens and closes the games
js/chess-engine.js  chess rules
js/chess.js         chess screen
js/catchstars.js    Catch Stars
js/flowermemory.js  Flower Memory
js/puzzle.js        Puzzle
```

To use a different puzzle picture, replace `puzzle.png` with another PNG that has the same name.
