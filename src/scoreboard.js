// Description:
//    Create scoreboards to keep track of scores for, you know, whatever! Can be differently styled scoreboards:
//       * points  - just keep track of points!
//       * winloss - the scoreboard keeps tracks of wins and losses with no further validation.
//       * zerosum - similar to winloss except the wins must equal the losses across all players.
//       * elo     - zerosum, records draws, and also calculates Elo!
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
const ELO_CONSTANT = process.env.HUBOT_SCOREBOARD_BUILDER_ELO_CONSTANT || 32;


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

    this.isPlayerOnScoreboard = (scoreboardName, playerName) => {
        const scoreboard = Bookie.getScoreboard(scoreboardName);
        return typeof scoreboard.players[playerName] !== 'undefined';
    };

    this.addPlayer = (scoreboardName, player) => {
        return Bookie.addPlayer(scoreboardName, player);
    };

    this.removePlayer = (scoreboardName, player) => {
        return Bookie.removePlayer(scoreboardName, player);
    };

     /**
    * Takes a score-ish and turns it into a number.
    *
    * @param {string} score the score to turn into a number: win, loss, or +/- N
    * @return int
    */
    this.numberifyScore = score => {
        let numberedScore = 0;
        if (!score) {
            numberedScore = 0;
        } else if (['win', 'won', 'winner'].includes(score)) {
            numberedScore = 1;
        } else if (['loss', 'lose', 'lost', 'loser'].includes(score)) {
            numberedScore = -1;
        } else if (score === 'draw') {
            numberedScore = .5;
        } else {
            numberedScore = Number(score);
        }
        return numberedScore;
    };

    this.getScoreData = (scoreboardType, score) => {
        let scoreData = {points: 0, wins: 0, losses: 0, draws: 0};
        if (scoreboardType == 'points') {
            scoreData.points = score
        } else {
            if (score == .5) {
                scoreData.draws = 1;
            } else if (score >= 0) {
                scoreData.wins = score;
            } else {
                scoreData.losses = score * -1;
            }
        }
        return scoreData;
    };

    this.calculateEloChange = (p1elo, p2elo, score) => {
        const expected = Math.pow(10, p1elo/400) / (Math.pow(10, p1elo/400) + Math.pow(10, p2elo/400));
        let eloChange = Math.round(ELO_CONSTANT * (score - expected));
        if (eloChange == 0){
            if ((score - expected) < 0) {
                eloChange = -1;
            } else {
                eloChange = 1;
            }
        }
        return eloChange;
    };

    this.markScores = (scoreboardName, scoreData) => {
        for (playerName of Object.keys(scoreData)) {
            let scores = scoreData[playerName];
            Bookie.adjustScores(scoreboardName, playerName, scores.wins, scores.losses, scores.draws, scores.points, scores.elo);
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
        if (items.length == 2) {
            return `${items[0]} and ${items[1]}`;
        } else {
            return `${items.slice(0, -1).join(', ')}, and ${items.slice(-1)[0]}`;
        }
    };

    // response builders

    /**
    * Takes in a list of possible responses and returns a random one
    * @param {list} responseList the list of responses
    * @return list item
    */
    this.getRandomResponse = (responseList) => {
        const i = Math.floor(Math.random() * responseList.length);
        return responseList[i];
    };

    this.getShowScoreboardMessage = scoreboardName => {
        const scoreboardResponses = [
            `Here's the play, see?\n${this.stringifyScoreboard(scoreboardName)}`,
            `The gravy train's ridin' all over town on this one.\n${this.stringifyScoreboard(scoreboardName)}`,
            `You got it, boss:\n${this.stringifyScoreboard(scoreboardName)}`,
            `Better keep this outta sight of the bulls, know what I'm sayin'?\n${this.stringifyScoreboard(scoreboardName)}`,
        ];
        return this.getRandomResponse(scoreboardResponses);
    }

    this.getAddPlayerSuccessMessage = (addedPlayers, scoreboardName) => {
        const addPlayersSuccessResponses = [
            `OK, I've penciled in ${addedPlayers} on ${scoreboardName}.`,
            `OK pal, I got ${addedPlayers}. We're all set here.`,
            `Johnny Two-fingers told me this fell'd take us all the way to the bank. ${addedPlayers} have been added on ${scoreboardName}.`,
            `Why do _you_ think his name is Johnny Two-fingers?`,
        ];
        return this.getRandomResponse(addPlayersSuccessResponses);
    }

    this.getNoAddedPlayersMessage = () => {
        const addPlayersFailResponses = [
            `All'a them bubs's already on the list, pal.`,
            `What, you tryin' to double up or somethin'? All's thems already on the list. Now get outta here.`,
        ];
        return this.getRandomResponse(addPlayersFailResponses);
    };

    this.getRemovePlayerMessage = players => {
        const removeResponses = [
            `Alright, Johnny. I don't know what business you two had, but I ain't askin' neither. ${players} is gone.`,
            `${players} is sleepin' with the fishes now, and that's all there is to it.`,
            `You want I should strike ${players} from the record, eh? Alright, you got it.`,
            `Alright buddy. You don't gotta worry about ${players} no more.`,
        ];
        return this.getRandomResponse(removeResponses);
    };

    this.getMissingPlayerMessage = (player, scoreboardName) => {
        const missingResponses = [
            `I don't know what kind of game you're playin' here, bud, but ${player} isn't marked on ${scoreboardName}.`,
            `Who you kiddin'? ${player} isn't marked on ${scoreboardName}.`,
        ];
        return this.getRandomResponse(missingResponses);
    };

    this.getMissingScoreboardMessage = scoreboardName => {
        const missingBoardResponses = [
            `I ain't never heard'a no ${scoreboardName}. Get away from me, kid, ya bother me.`,
        ];
        return this.getRandomResponse(missingBoardResponses);
    };

    this.getArchivedScoreboardMessage = scoreboardName => {
        const archivedBoardResponses = [
            `Look, I can track ${scoreboardName} down for yas, but y'can't change it no more.`,
            `All I got is the last time anyone's seen ${scoreboardName}. It's under wraps now.`,
            `Ain't no one seen ${scoreboardName} in years. I can describe it for yas though.`,
        ];
        return this.getRandomResponse(archivedBoardResponses);

    };

    // scoreboard functions

    this.getWinPercentage = player => {
        const totalGames = player.wins + player.losses;
        if (totalGames == 0) {
            return player.points - 1;
        }
        return player.wins / totalGames;
    };

    this.getWinValue = (player, scoreboardType) => {
        if (scoreboardType === 'elo') {
            return player.elo;
        }
        if (scoreboardType === 'points') {
            return player.points - 1;
        }
        // draws are new, so just in case...
        const draws = typeof player.draws === 'undefined' ? 0 : player.draws;
        const totalGames = player.wins + player.losses + draws;
        return (player.wins - player.losses) + totalGames + 1;
    };

     /**
    * Prints the scoreboard all pretty-like.
    *
    * @param {string} scoreboardName the name of the scoreboard to turn into a string
    * @return string
    */
    this.stringifyScoreboard = scoreboardName => {
        const scoreboard = this.getScoreboard(scoreboardName);
        const players = Object.entries(scoreboard.players).map(player => Object.assign({name: player[0]}, player[1]));
        let playerColWidth = players.reduce((p1, p2) => (p1.name.length > p2.name.length ? p1 : p2)).name.length + 1;
        if (playerColWidth < 10) {
            playerColWidth = 10;
        }
        const colWidth = 10;
        let numCols = 1;
        let headerRow = '';
        if (scoreboard.type === 'points') {
            headerRow = `${'Points'.padStart(colWidth)} |`;
        } else if (['winloss', 'zerosum'].includes(scoreboard.type)) {
            numCols = 2;
            headerRow = `${'Wins'.padStart(colWidth)} | ${'Losses'.padStart(colWidth)} |`;
        } else if (scoreboard.type === 'elo') {
            numCols = 4;
            headerRow = `${'Wins'.padStart(colWidth)} | ${'Losses'.padStart(colWidth)} | ${'Draws'.padStart(colWidth)} | ${'Elo'.padStart(colWidth)} |`;
        }

        const boardWidth = (playerColWidth + 2) + ((colWidth + 3) * numCols);
        let boardString = '```' + `.${'_'.repeat(scoreboardName.length + 2)}.\n| ${scoreboardName} :`;
        if (scoreboard.archived) {
            boardString += ' :lock:';
        }
        boardString += `\n+${'-'.repeat(boardWidth)}.\n`;
        boardString += `| ${'Player'.padEnd(playerColWidth)} | ${headerRow}\n`;
        boardString += `|${'='.repeat(boardWidth)}|\n`;

        const sortedPlayers = players.sort((p1, p2) => this.getWinValue(p2, scoreboard.type) - this.getWinValue(p1, scoreboard.type));
        for (player of sortedPlayers) {
            boardString += `| ${player.name.padEnd(playerColWidth)} `;
            if (scoreboard.type == 'points') {
                boardString += `| ${player.points.toString().padStart(colWidth)} |\n`;
            } else if (['winloss', 'zerosum'].includes(scoreboard.type)) {
                let wins = player.wins.toString();
                let losses = player.losses.toString();
                boardString += `| ${wins.padStart(colWidth)} | ${losses.padStart(colWidth)} |\n`;
            } else if (scoreboard.type === 'elo') {
                let wins = player.wins.toString();
                let losses = player.losses.toString();
                let draws = player.draws.toString();
                let elo = player.elo.toString();
                boardString += `| ${wins.padStart(colWidth)} | ${losses.padStart(colWidth)} | ${draws.padStart(colWidth)} | ${elo.padStart(colWidth)} |\n`;
            }
        }
        boardString += `º${'-'.repeat(boardWidth)}º` + '```';
        return boardString;
    };

    // handlers

    this.handleCreateScoreboard = (response, scoreboardName, type, user) => {
        if (this.createScoreboard(scoreboardName, type, user)) {
            response.send(`All right mac, I gotcha down. ${scoreboardName} is on the books.`);
        } else {
            response.send(`Sorry bub, I'm already keepin' scores under ${scoreboardName}. Pick another one.`);
        }
    };

    this.handleGetScoreboard = (response, scoreboardName) => {
        const scoreboard = this.getScoreboard(scoreboardName);
        if (scoreboard === null) {
            response.send(this.getMissingScoreboardMessage(scoreboardName));
            return;
        }
        if (Object.keys(scoreboard.players).length > 0) {
            response.send(this.getShowScoreboardMessage(scoreboardName));
        } else {
            response.send(`Ain't much t'tell ya, mac. There are no players for ${scoreboardName}. You can add some with the addplayers command.`);
        }
    };

    this.handleArchiveScoreboard = (response, scoreboardName, user) => {
        if (this.archiveScoreboard(scoreboardName, user)) {
            response.send(`OK, I'll put ${scoreboardName} on ice for yas.`);
        } else {
            response.send(`Hey, don't get pushy with me pal. Only ${this.getOwner(scoreboardName)} can archive ${scoreboardName}.`);
        }
    };

    this.handleUnarchiveScoreboard = (response, scoreboardName, user) => {
        if (this.unarchiveScoreboard(scoreboardName, user)) {
            response.send(`OK, ${scoreboardName} is thawed out real nice.`);
        } else {
            response.send(`Only ${this.getOwner(scoreboardName)} knows the whereabouts o' ${scoreboardName}. You'll have to ask them.`);
        }
    };

    this.handleDeleteScoreboard = (response, scoreboardName, user) => {
        if (this.deleteScoreboard(scoreboardName, user)) {
            response.send(`OK, I'll pretend I ain't never seen yas.`);
        } else {
            response.send(`We got a wise guy over here. Only the scoreboard owner, ${this.getOwner(scoreboardName)}, can delete ${scoreboardName}!`);
        }
    };

    this.handleAddPlayers = (response, scoreboardName, players) => {
        const scoreboard = this.getScoreboard(scoreboardName);
        if (scoreboard === null) {
            response.send(this.getMissingScoreboardMessage(scoreboardName));
            return;
        } else if (scoreboard.archived) {
            response.send(this.getArchivedScoreboardMessage(scoreboardName));
            return;
        }
        const playerList = players.split(' ').map((player) => player[0] === '@' ? player.slice(1) : player );
        let addedPlayers = [];
        playerList.forEach((playerName) => {
            if (!this.isPlayerOnScoreboard(scoreboardName, playerName)) {
                this.addPlayer(scoreboardName, playerName);
                addedPlayers.push(playerName)
            }
        });
        if (addedPlayers.length == 2) {
            addedPlayers.push("_your mother_");
        }
        if (addedPlayers.length > 0) {
            response.send(this.getAddPlayerSuccessMessage(this.getNiceList(addedPlayers), scoreboardName));
        } else {
            response.send(this.getNoAddedPlayersMessage());
        }
    };

    this.handleRemovePlayers = (response, scoreboardName, players) => {
        const scoreboard = this.getScoreboard(scoreboardName);
        if (scoreboard === null) {
            response.send(this.getMissingScoreboardMessage(scoreboardName));
            return;
        } else if (scoreboard.archived) {
            response.send(this.getArchivedScoreboardMessage(scoreboardName));
            return;
        }
        const playerList = players.split(' ').map((player) => player[0] === '@' ? player.slice(1) : player );
        playerList.forEach((player) => {
            this.removePlayer(scoreboardName, player);
        });
        response.send(this.getRemovePlayerMessage(this.getNiceList(players)));
    };

    this.handleMarkScore = (response, scoreboardName, player1, player1score, player2, player2score) => {
        const scoreboard = this.getScoreboard(scoreboardName);
        if (scoreboard === null) {
            response.send(this.getMissingScoreboardMessage(scoreboardName));
            return;
        } else if (scoreboard.archived) {
            response.send(this.getArchivedScoreboardMessage(scoreboardName));
            return;
        }
        if (!this.isPlayerOnScoreboard(scoreboardName, player1)) {
            response.send(this.getMissingPlayerMessage(player1, scoreboardName));
            return;
        }
        let scores = {};
        scores[player1] = this.getScoreData(scoreboard.type, player1score);
        if (player1score == .5) {
            player2score = player1score;  // draw
        }
        if (typeof player2 !== 'undefined') {
            if (!this.isPlayerOnScoreboard(scoreboardName, player2)) {
                response.send(this.getMissingPlayerMessage(player2, scoreboardName));
                return;
            }
            scores[player2] = this.getScoreData(scoreboard.type, player2score);
        }
        if (['zerosum', 'elo'].includes(scoreboard.type)) {
            if (typeof response.match[5] === 'undefined') {
                response.send(`What's the big idea? ${scoreboardName} tracks a zero-sum game. I need the other player to mark, Einstein.`)
                return;
            }
            if (player1score != .5 && player1score + player2score != 0) {
                response.send(`Hey, you new around here? Zero-sum games like ${scoreboardName} is tracking need their scores to add to 0. ${player1score} and ${player2score} ain't gonna cut it.`);
                return;
            }
        }
        if (scoreboard.type === 'elo') {
            const eloChange = this.calculateEloChange(scoreboard.players[player1].elo, scoreboard.players[player2].elo, player1score < 0 ? 0 : player1score);
            scores[player1].elo = eloChange;
            scores[player2].elo = eloChange * -1;
        }
        this.markScores(scoreboardName, scores);
        response.send(`OK pal, here's the latest standin's:\n\n${this.stringifyScoreboard(scoreboardName)}`);
    };

    // responses

    robot.respond(/scoreboard create (\w+) (points|winloss|zerosum|elo)\s*$/i, response => {
        this.handleCreateScoreboard(response, response.match[1], response.match[2], this.getUsername(response));
    });

    robot.respond(/scoreboard archive (\w+)\s*$/i, response => {
        this.handleArchiveScoreboard(response, response.match[1], this.getUsername(response));
    });

    robot.respond(/scoreboard unarchive (\w+)\s*$/i, response => {
        this.handleUnarchiveScoreboard(response, response.match[1], this.getUsername(response));
    });

    robot.respond(/scoreboard delete (\w+)\s*$/i, response => {
        this.handleDeleteScoreboard(response, response.match[1], this.getUsername(response));
    });

    robot.respond(/scoreboard (\w+)$/i, response => {
        this.handleGetScoreboard(response, response.match[1]);
    });

    robot.respond(/addplayers? (\w+) ((?:@?\w+\s*)+)\s*$/i, response => {
        this.handleAddPlayers(response, response.match[1], response.match[2]);
    });

    robot.respond(/removeplayers? (\w+) ((?:@?\w+\s*)+)\s*$/i, response => {
        this.handleRemovePlayers(response, response.match[1], response.match[2]);
    });

    robot.respond(/markscore (\w+?) ([+-][\d]+|win|won|loss|lose|lost|draw) @?(\w+?)(?: ([+-][\d]+|win|won|loss|lose|lost|draw)? ?@?(\w+?))?\s*$/i, response => {
        this.handleMarkScore(response, response.match[1], response.match[3], this.numberifyScore(response.match[2]), response.match[5], this.numberifyScore(response.match[4]));
    });
};
