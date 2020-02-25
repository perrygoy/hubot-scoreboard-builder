// Description
//   ScoreKeeper module
//   Stores, retrieves, modifies, and deletes scoreboards for hubot.

module.exports = function(robot) {
    // private functions

    var getScoreboards = () => {
        return robot.brain.data.scoreboards || {};
    };

    var save = scoreboards => {
        robot.brain.data.scoreboards = scoreboards;
        robot.brain.emit('save', robot.brain.data);
    }

    // public functions

    this.createScoreboard = (scoreboardName, type, user) => {
        let scoreboards = getScoreboards();
        if (typeof scoreboards[scoreboardName] !== 'undefined') {
            return false;
        }
        scoreboards[scoreboardName] = {
            type: type,
            owner: user,
            archived: false,
            players: {},
        };
        save(scoreboards);
        return Object.assign({}, scoreboards[scoreboardName]);
    };

    this.archiveScoreboard = (scoreboardName, user) => {
        const scoreboard = this.getScoreboard(scoreboardName);
        if (user != scoreboard.owner) {
            return false;
        }
        let scoreboards = getScoreboards();
        scoreboards[scoreboardName].archived = true;
        save(scoreboards);
        return true;
    };

    this.unarchiveScoreboard = (scoreboardName, user) => {
        const scoreboard = this.getScoreboard(scoreboardName);
        if (user != scoreboard.owner) {
            return false;
        }
        let scoreboards = getScoreboards();
        scoreboards[scoreboardName].archived = false;
        save(scoreboards);
        return true;
    };

    this.deleteScoreboard = (scoreboardName, user) => {
        const scoreboard = this.getScoreboard(scoreboardName);
        if (user != scoreboard.owner) {
            return false;
        }
        let scoreboards = getScoreboards();
        delete scoreboards[scoreboardName];
        save(scoreboards);
        return true;
    };

    this.getScoreboard = scoreboardName => {
        const scoreboards = getScoreboards();
        if (typeof scoreboards[scoreboardName] === 'undefined') {
            return null;
        }
        return Object.assign({name: scoreboardName}, scoreboards[scoreboardName]);
    };

    this.getScoreboards = () => {
        const scoreboards = getScoreboards();
        let boardList = [];
        for (let scoreboardName of Object.keys(scoreboards).sort((name1, name2) => name2 < name1)) {
            boardList.push(Object.assign({'name': scoreboardName}, scoreboards[scoreboardName]))
        }
        return boardList;
    };

    this.getAllScoreboards = () => {
        const scoreboards = getScoreboards();
        return Object.assign({}, scoreboards);
    };

    this.getOwner = scoreboardName => {
        const scoreboard = this.getScoreboard(scoreboardName);
        if (scoreboard === null) {
            return null;
        }
        return scoreboard.owner;
    };

    this.addPlayer = (scoreboardName, playerName) => {
        let scoreboards = getScoreboards();
        if (typeof scoreboards[scoreboardName] === 'undefined') {
            return false;
        } else if(typeof scoreboards[scoreboardName].players[playerName] !== 'undefined') {
            return false
        }
        scoreboards[scoreboardName].players[playerName] = {
            wins: 0,
            losses: 0,
            draws: 0,
            points: 0,
            elo: 1500,
        };
        save(scoreboards);
        return true;
    };

    this.changePlayer = (scoreboardName, oldName, newName) => {
        let scoreboards = getScoreboards();
        if (typeof scoreboards[scoreboardName] === 'undefined') {
            return false;
        } else if (typeof scoreboards[scoreboardName].players[oldName] === 'undefined') {
            return false;
        }
        scoreboards[scoreboardName].players[newName] = scoreboards[scoreboardName].players[oldName];
        delete scoreboards[scoreboardName].players[oldName];
        save(scoreboards);
        return true;
    }

    this.removePlayer = (scoreboardName, playerName) => {
        let scoreboards = getScoreboards();
        if (typeof scoreboards[scoreboardName] === 'undefined') {
            return false;
        }
        delete scoreboards[scoreboardName].players[playerName];
        save(scoreboards);
        return true;
    };

    this.adjustScores = (scoreboardName, playerName, wins = 0, losses = 0, draws = 0, points = 0, elo = 0) => {
        let scoreboards = getScoreboards();
        if (typeof scoreboards[scoreboardName] === 'undefined') {
            return false;
        }
        let player = scoreboards[scoreboardName].players[playerName];
        player.wins += wins;
        player.losses += losses;
        player.draws += draws;
        player.points += points;
        player.elo += elo;
        save(scoreboards);
        return Object.assign({}, scoreboards[scoreboardName]);
    };
};

