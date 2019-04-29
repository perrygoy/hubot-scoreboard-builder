hubot-scoreboard-builder
========================

Create scoreboards to keep track of wins, losses, and points for whatever you want!

    hubot createscoreboard Duels zerosum
    > All right mac, I gotcha down. Duels is on the books.
    hubot addplayers Perry Katy Vince Jerome
    > OK, I've penciled in Perry, Katy, Vince, and Jerome on Duels.
    hubot markscore +2 Perry -2 Vince
    > OK pal, here's the latest standin's:
    > ._______.
    > | Duels :
    > +---------------------------------.
    > | Players |      Wins |    Losses |
    > |=================================|
    > | Perry   |         2 |         0 |
    > | Katy    |         0 |         0 |
    > | Vince   |         0 |         2 |
    > | Jerome  |         0 |         0 |
    > ^---------------------------------^
    hubot removeplayer Duels Jerome
    > OK, I've erased Jerome from Duels, if you catch my drift.

## Commands

* hubot scoreboard create {name} [winloss|zerosum|points] - create a new scoreboard with the given name and game style.
* hubot scoreboard delete {scoreboard} - remove a scoreboard. Only the scoreboard's creator can do this.
* hubot addplayer {scoreboard} {player} - add a player to the scoreboard.
* hubot removeplayer {scoreboard} {player} - remove a player from the scoreboard.
* hubot markscore {scoreboard} win {user} [loss {user}] - mark a winner/loser! The second user is optional if the scoreboard is not zerosum.
* hubot markscore {scoreboard} +N {user} [-N {user}] - mark a score increase or decrease! The second user is optional if the scoreboard is not zerosum.

Uses hubot-brain to keep track of the quotes.

## Types of Scoreboards

There are three different types of scoreboards:
* points
  * just keeps track of points. Very simple!
* winloss
  * keeps track of wins and losses, but doesn't verify that they add up to 0.
* zerosum
  * keeps track of wins and losses, enforcing that the total scores add up to 0.
* elo
  * all the rigueur of zerosum while also calculating Elo scores.

## Add it to your hubot!

Run the following command

    $ npm install hubot-scoreboard --save

Then add `hubot-scoreboard` to the `external-scripts.json` file (you may need to create this file).

    ["hubot-scoreboard"]
