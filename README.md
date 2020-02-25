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
    > | Duels : zerosum
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
* hubot scoreboard {name} [full|playername] - view a scoreboard. Full will show the full board, playername will return playername's record specifically, if neither are included then that board's top SHOW_NUM will be shown.
* hubot addplayer {scoreboard} {player} - add a player to the scoreboard.
* hubot changeplayer {scoreboard} {oldname} {newname} - update a player's name
* hubot removeplayer {scoreboard} {player} - remove a player from the scoreboard.
* hubot markscore {scoreboard} win {user} [loss {user}] - mark a winner/loser! The second user is optional if the scoreboard is not zerosum or elo.
* hubot markscore {scoreboard} +N {user} [-N {user}] - mark a score increase or decrease! The second user is optional if the scoreboard is not zerosum or elo.
* !mark ... - shorthand for the above two commands that replaces the "hubot markscore" part.

Uses hubot-brain to keep track of the scoreboards.

## Configuration

Scoreboard-builder uses two environment variables:

* `HUBOT_SCOREBOARD_BUILDER_ELO_CONSTANT` to set the ELO constant (K, if you're familiar with [the formula](https://en.wikipedia.org/wiki/Elo_rating_system#Mathematical_details)). The default is 32, which is somewhat common, but you can change it to your whims.
* `HUBOT_SCOREBOARD_BUILDER_SHOW_NUM` to configure how many people to show maximum on a scoreboard, unless you ask for the full list. Default is the top 5.

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
