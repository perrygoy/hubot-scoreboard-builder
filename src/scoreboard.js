// Description:
//    Create scoreboards to keep track of scores for, you know, whatever! Can be differently styled scoreboards:
//       * points  - just keep track of points!
//       * winloss - the scoreboard keeps tracks of wins and losses with no further validation.
//       * zerosum - similar to winloss except the wins must equal the losses across all players.
//
// Commands:
//   scoreboard create {name} [winloss|zerosum|points] - create a new scoreboard with the given name and game style.
//   scoreboard delete {scoreboard} - remove a scoreboard. Only the scoreboard's creator can do this.
//   scoreboard {name} - view a scoreboard.
//   addplayer {scoreboard} {player} - add a player to the scoreboard.
//   removeplayer {scoreboard} {player} - remove a player from the scoreboard.
//   markscore {scoreboard} win {user} [loss {user}] - mark a winner/loser!
//       The second user is optional if the scoreboard is not zerosum.
//   markscore {scoreboard} +N {user} [-N {user}] - mark a score increase or decrease!
//       The second user is optional if the scoreboard is not zerosum.
//
// Author:
//   Perry Goy https://github.com/perrygoy


const ScoreKeeperMod = require('./scorekeeper');


module.exports = function(robot) {
    const Bookie = new ScoreKeeperMod(robot);

    this.getUsername = response => {
        const user = response.message.user;
    if (user.profile) {
            return user.profile.display_name || user.name;
        } else {
            return user.name;
        }
    };

    this.createScoreboard = (scoreboardName, type, user) => {
        return Bookie.createScoreboard(scoreboardName, type, user);
    };

    this.deleteScoreboard = (scoreboardName, user) => {
        return Bookie.deleteScoreboard(scoreboardName, user);
    };

    this.getScoreboard = scoreboardName => {
        const scoreboard = Bookie.getScoreboard(scoreboardName);
        return scoreboard;
    };

    this.getOwner = scoreboardName => {
        return Bookie.getOwner(scoreboardName);
    };

    this.isPlayerOnScoreboard = (scoreboard, playerName) => {
        return typeof scoreboard.players[playerName] !== 'undefined';
    };

    this.addPlayer = (scoreboardName, player) => {
        return Bookie.addPlayer(scoreboardName, player);
    };

    this.removePlayer = (scoreboardName, player) => {
        return Bookie.removePlayer(scoreboardName, player);
    };

    this.getScoreObject = (scoreboardType, score) => {
        let scoreObj = {points: 0, wins: 0, losses: 0};
        if (scoreboardType == 'points') {
            scoreObj.points = score
        } else {
            if (score >= 0) {
                scoreObj.wins = score;
            } else {
                scoreObj.losses = score * -1;
            }
        }
        return scoreObj;
    };

    this.markScores = (scoreboardName, scoreObj) => {
        for (playerName of Object.keys(scoreObj)) {
            let scores = scoreObj[playerName];
            Bookie.adjustScores(scoreboardName, playerName, scores.wins, scores.losses, scores.points);
        }
    };

     /**
    * Takes a list and returns a string all nice. For example, [1, 2, 3] returns "1, 2, and 3".
    *
    * @param {array} items the list of items to listify
    * @return string
    */
    this.getNiceList = (items) => {
        if (items.length == 1) {
            return items[0];
        }
        return `${items.slice(0, -1).join(', ')}, and ${items.slice(-1)[0]}`;
    };

     /**
    * Takes a score-ish and turns it into a number.
    *
    * @param {string} score the score to turn into a number: win, loss, or +/- N
    * @return int
    */
    this.numberifyScore = score => {
        let numberedScore = 0;
        if (['win', 'won', 'winner'].includes(score)) {
            numberedScore = 1;
        } else if (['loss', 'lose', 'lost', 'loser'].includes(score)) {
            numberedScore = -1;
        } else {
            numberedScore = Number(score);
        }
        return numberedScore;
    };

    this.getWinPercentage = player => {
        const totalGames = player.wins + player.losses;
        if (totalGames == 0) {
            return -1;
        }
        return player.wins / totalGames;
    };

     /**
    * Prints the scoreboard all pretty-like.
    *
    * @param {string} scoreboardName the name of the scoreboard to turn into a string
    * @return string
    */
    this.stringifyScoreboard = scoreboardName => {
        const scoreboard = this.getScoreboard(scoreboardName);
        const players = scoreboard.players.sort((p1, p2) => this.getWinPercentage(p2) - this.getWinPercentage(p1));
        let playerColWidth = Object.keys(players).reduce((p1, p2) => (p1.length > p2.length ? p1 : p2)).length + 1;
        if (playerColWidth < 10) {
            playerColWidth = 10;
        }
        const colWidth = 10;
        const numCols = (scoreboard.type == 'points' ? 1 : 2);
        const boardWidth = (playerColWidth + 2) + ((colWidth + 3) * numCols)

        let boardString = '```' + `.${'_'.repeat(scoreboardName.length + 2)}.\n| ${scoreboardName} :\n`;
        boardString += `+${'-'.repeat(boardWidth)}.\n`;

        let headerRow = '';
        if (scoreboard.type == 'points') {
            headerRow += `${'Points'.padStart(colWidth)} |`;
        } else {
            headerRow += `${'Wins'.padStart(colWidth)} | ${'Losses'.padStart(colWidth)} |`;
        }
        boardString += `| ${'Player'.padEnd(playerColWidth)} | ${headerRow}\n`;
        boardString += `|${'='.repeat(boardWidth)}|\n`;

        for (player of Object.keys(players)) {
            boardString += `| ${player.padEnd(playerColWidth)} `;
            if (scoreboard.type == 'points') {
                boardString += `| ${players[player].points.toString().padStart(colWidth)} |\n`;
            } else {
                let wins = players[player].wins.toString();
                let losses = players[player].losses.toString();
                boardString += `| ${wins.padStart(colWidth)} | ${losses.padStart(colWidth)} |\n`;
            }
        }
        boardString += `º${'-'.repeat(boardWidth)}º` + '```';
        return boardString;
    };

    this.getMissingScoreboardMessage = scoreboardName => {
        return `I ain't never heard'a no ${scoreboardName}. Get away from me, kid, ya bother me.`
    };

    // responses

    robot.respond(/scoreboard create (\w+) (winloss|zerosum|points)\s*$/i, response => {
        const scoreboardName = response.match[1];
        const type = response.match[2];
        const user = this.getUsername(response);

        if (this.createScoreboard(scoreboardName, type, user)) {
            response.send(`All right mac, I gotcha down. ${scoreboardName} is on the books.`);
        } else {
            response.send(`Sorry bub, I'm already keepin' scores under ${scoreboardName}. Pick another one.`);
        }
    });

    robot.respond(/scoreboard delete (\w+)\s*$/i, response => {
        const scoreboardName = response.match[1];
        const user = this.getUsername(response);

        if (this.deleteScoreboard(scoreboardName, user)) {
            response.send(`OK, I'll pretend I ain't never seen yas.`);
        } else {
            const owner = this.getOwner(scoreboardName);
            response.send(`We got a wise guy over here. Only the scoreboard owner, ${owner}, can delete ${name}!`);
        }
    });

    robot.respond(/scoreboard (\w+)$/i, response => {
        const scoreboardName = response.match[1];
        const scoreboard = this.getScoreboard(scoreboardName);
        if (scoreboard === null) {
            response.send(this.getMissingScoreboardMessage(scoreboardName));
            return;
        }
        if (Object.keys(scoreboard.players).length > 0) {
            response.send(`You got it, boss:\n${this.stringifyScoreboard(scoreboardName)}`);
        } else {
            response.send(`Ain't much t'tell ya, mac. There are no players for ${scoreboardName}. You can add some with the addplayers command.`);
        }
    });

    robot.respond(/addplayers? (\w+) ((?:@?\w+\s*)+)\s*$/i, response => {
        const scoreboardName = response.match[1];
        const scoreboard = this.getScoreboard(scoreboardName);
        if (scoreboard === null) {
            response.send(this.getMissingScoreboardMessage(scoreboardName));
            return;
        }
        let players = response.match[2]
            .split(' ')
            .map((player) => player[0] === '@' ? player.slice(1) : player );
        let addedPlayers = [];
        players.forEach((playerName) => {
            if (!this.isPlayerOnScoreboard(scoreboard, playerName)) {
                this.addPlayer(scoreboardName, playerName);
                addedPlayers.push(playerName)
            }
        });
        if (addedPlayers.length > 0) {
            response.send(`OK, I've penciled in ${this.getNiceList(addedPlayers)} on ${scoreboardName}.`);
        } else {
            response.send(`All'a them bubs's already on the list, pal.`);
        }
    });

    robot.respond(/removeplayers? (\w+) ((?:@?\w+\s*)+)\s*$/i, response => {
        const scoreboardName = response.match[1];
        if (this.getScoreboard(scoreboardName) === null) {
            response.send(this.getMissingScoreboardMessage(scoreboardName));
            return;
        }
        let players = response.match[2]
            .split(' ')
            .map((player) => player[0] === '@' ? player.slice(1) : player );
        players.forEach((player) => {
            this.removePlayer(scoreboardName, player);
        });

        response.send(`OK, I've erased ${this.getNiceList(players)} from ${scoreboardName}, if you catch my drift.`);
    });

    robot.respond(/markscore (\w+?) ([+-][\d]+|win|won|loss|lose|lost) @?(\w+?)(?: ([+-][\d]+|win|won|loss|lose|lost) @?(\w+?))?\s*$/i, response => {
        const scoreboardName = response.match[1];
        const scoreboard = this.getScoreboard(scoreboardName);
        if (scoreboard === null) {
            response.send(this.getMissingScoreboardMessage(scoreboardName));
            return;
        }

        const firstScore = this.numberifyScore(response.match[2]);
        const firstPlayer = response.match[3];
        if (!this.isPlayerOnScoreboard(scoreboard, firstPlayer)) {
            response.send(`I don't know what kind of game you're playin' here, bud, but ${firstPlayer} isn't marked on ${scoreboardName}.`);
            return;
        }

        let scores = {};
        scores[firstPlayer] = this.getScoreObject(scoreboard.type,firstScore);
        let secondScore = 0;
        if (typeof response.match[5] !== 'undefined') {
            secondScore = this.numberifyScore(response.match[4]);
            const secondPlayer = response.match[5];

            if (!this.isPlayerOnScoreboard(scoreboard, secondPlayer)) {
                response.send(`Who you kiddin'? ${secondPlayer} isn't marked on ${scoreboardName}.`);
                return;
            }
            scores[secondPlayer] = this.getScoreObject(scoreboard.type, secondScore);
        }
        if (scoreboard.type == 'zerosum') {
            if (typeof response.match[5] === 'undefined') {
                response.send(`What's the big idea? ${scoreboardName} is a zero-sum scoreboard. I need the other player to mark, Einstein.`)
                return;
            }
            if (firstScore + secondScore != 0) {
                response.send(`Hey, you new around here? Zero-sum scoreboards like ${scoreboardName} need their scores to add to 0. ${firstScore} and ${secondScore} ain't gonna cut it.`);
                return;
            }
        }
        this.markScores(scoreboardName, scores);
        response.send(`OK pal, here's the latest standin's:\n\n${this.stringifyScoreboard(scoreboardName)}`);
    });
};
