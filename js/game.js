var game = (function () {
    // Constants
    var AVAILABLE_CARDS_COUNT = 37;
    var MIN_BOARD_SIZE = 2;
    var MAX_BOARD_SIZE = 8;
    var DEFAULT_BOARD_SIZE = 2;

    // 'Enums'
    var ViewType = {
        Settings: 1,
        Board: 2,
        BestScoreTable: 3,
    };

    // Module members
    var audioWin = new Audio('sound/win.mp3');
    var audioRight = new Audio('sound/right.mp3');
    var audioWrong = new Audio('sound/wrong.mp3');
    var _viewType = ViewType.Settings;
    var boardSize = DEFAULT_BOARD_SIZE;
    var defaultMargin = Number(window.getComputedStyle(document.body).margin[0]);
    var couplesCount = 0;
    var flippedCouplesCount = 0;
    var isPlaying = false;
    var isProcessing = false;
    var isPaused = false;
    var elPreviousCard = null;
    var gameControls = [elControlsPanel, elTimer, elBestScore];
    var timer;
    var seconds = 0;

    //#region Public API Implementation
    function init() {
        initElements();
        setView(ViewType.Settings);
        document.onkeydown = () => handleKeydownEvent(event.key);
    }

    function playerNameChanged() {
        setStartButtonAvailability();
    }

    function boardSizeChanged() {
        if (txtBoardSize.value.length > 1) {
            txtBoardSize.value = txtBoardSize.value.slice(0, 1);
        }
        setStartButtonAvailability();
    }

    function newGame() {
        localStorage.setItem("playerName", txtPlayerName.value);
        localStorage.setItem("boardSize", txtBoardSize.value);
        boardSize = Number(txtBoardSize.value);
        setView(ViewType.Board);
        initGame();
    }

    async function pause() {
        await stopTimer();
        isPaused = true;
        btnPause.style.display = "none";
    }

    function play() {
        isPlaying = true;
        isPaused = false;
        startTimer();
        btnPlay.style.display = "";
        btnPause.style.display = "";
        btnRestart.style.display = "";
    }

    function restart() {
        initGame();
    }

    function showSettings() {
        stopTimer();
        setView(ViewType.Settings);
    }
    //#endregion Public API Implementation

    //#region Settings View
    function initSettingsView() {
        txtPlayerName.value = localStorage.getItem("playerName");
        txtBoardSize.value = localStorage.getItem("boardSize") || DEFAULT_BOARD_SIZE;
        setStartButtonAvailability();
    }

    function setStartButtonAvailability() {
        if (txtPlayerName.value.length === 0 || ![2, 4, 6, 8].includes(Number(txtBoardSize.value))) {
            btnStart.setAttribute("disabled", true);
        }
        else {
            btnStart.removeAttribute("disabled");
        }
    }
    //#endregion Settings View

    //#region Game View
    function createGameBoard() {
        elBoardPanel.innerHTML = "";

        var maxWidth = document.documentElement["clientWidth"];
        var maxHeight = document.documentElement["clientHeight"] - elBoardPanel.offsetTop;
        var boardWidth = Math.min(maxWidth, maxHeight) - defaultMargin * 2;
        var cardSize = Math.floor(boardWidth / boardSize) - defaultMargin * 2;

        var deck = getNewDeck();

        for (var row = 0; row < boardSize; row++) {
            for (var col = 0; col < boardSize; col++) {
                var cardIndex = row * boardSize + col;
                var elCard = getNewCardElement(deck[cardIndex], cardSize);
                elBoardPanel.appendChild(elCard);
            }
            elBoardPanel.innerHTML += "<br style='clear:both' />";
        }

        for (const element of elBoardPanel.children) {
            if (element.classList.contains('flip-container')) {
                element.onclick = cardClicked;
                // support touch screens
                element.ontouchstart = cardClicked;
            }
        }
    }

    function getNewDeck() {
        var cardsCount = boardSize * boardSize;
        couplesCount = cardsCount / 2;

        var deck = Array(cardsCount);
        var cardIds = Array(AVAILABLE_CARDS_COUNT);

        for (let index = 0; index < couplesCount; index++) {
            var cardId = getFreeIndex(cardIds);
            cardIds[cardId] = true;

            var firstCardIndex = getFreeIndex(deck);
            deck[firstCardIndex] = cardId + 1;

            var secondCardIndex = getFreeIndex(deck);
            deck[secondCardIndex] = cardId + 1;
        }

        return deck;
    }

    function getNewCardElement(cardId, cardSize) {
        var elContainer = document.createElement("div");
        elContainer.style.width = cardSize + "px";
        elContainer.style.height = cardSize + "px";
        elContainer.setAttribute("data-card", cardId);
        elContainer.classList = "flip-container";

        var elCard = document.createElement("div");
        elCard.style.width = cardSize + "px";
        elCard.style.height = cardSize + "px";
        elCard.classList = "card";
        elContainer.appendChild(elCard);

        var elCardFront = document.createElement("div");
        elCardFront.style.width = cardSize + "px";
        elCardFront.style.height = cardSize + "px";
        elCardFront.classList = "card-front";
        elCardFront.appendChild(getCardFrontImage(cardId));
        elCard.appendChild(elCardFront);

        var elCardBack = document.createElement("div");
        elCardBack.style.width = cardSize + "px";
        elCardBack.style.height = cardSize + "px";
        elCardBack.classList = "card-back";
        elCardBack.appendChild(getCardBackImage());
        elCard.appendChild(elCardBack);

        return elContainer;
    }

    function getCardFrontImage(cardId) {
        var image = document.createElement("img");
        image.src = "img/cards/" + cardId + ".png";
        return image;
    }

    function getCardBackImage() {
        var image = document.createElement("img");
        image.src = "img/cards/back.png";
        return image;
    }

    function startTimer() {
        timer = setInterval(() => elTimer.innerHTML = formatTime(++seconds), 1000);
    }

    async function stopTimer() {
        clearInterval(timer);
        await delay(1000);  // wait 1 second to ensure timer has stopped
    }

    async function resetTimer() {
        if (isPlaying) {
            await stopTimer();
        }
        seconds = 0;
        elTimer.innerHTML = "00:00:00";
    }

    function cardClicked() {
        if (isProcessing)
            return;

        if (isPaused || !isPlaying) {
            play();
        }

        elCard = this;

        // If the card is already flipped - return
        if (elCard.classList.contains('flipped')) {
            return;
        }

        // Flip card
        elCard.classList.add("flipped");

        // If the card is the first to be chosen => keep it in a global variable and return
        if (elPreviousCard === null) {
            elPreviousCard = elCard;
            return;
        }

        // Get the data-card attribute's value from both current and previous cards
        var card1 = elPreviousCard.getAttribute('data-card');
        var card2 = elCard.getAttribute('data-card');

        if (card1 === card2) {
            handleMatch(elCard);
        }
        else {
            handleNoMatch(elCard);
        }
    }

    function handleMatch(flippedCard) {
        flippedCouplesCount++;
        elPreviousCard = null;

        // Check if all cards are flipped
        if (flippedCouplesCount === couplesCount) {
            endGame();
        }
        else {
            audioRight.play();
        }
    }

    function handleNoMatch(flippedCard) {
        isProcessing = true;
        audioWrong.play();
        // flip cards back in 1 second
        setTimeout(function () {
            flippedCard.classList.remove('flipped');
            elPreviousCard.classList.remove('flipped');
            elPreviousCard = null;
            isProcessing = false;
        }, 1000);
    }

    async function endGame() {
        stopTimer();
        isPlaying = false;
        btnPause.style.display = "none";
        btnPlay.style.display = "none";
        audioWin.play();
        if (isNewHighScore()) {
            updateBestScoreTable();
            await delay(1500);
            setView(ViewType.BestScoreTable);
        }
    }

    function isNewHighScore() {
        var bestScore = localStorage.getItem("bestScore" + boardSize);
        if (!bestScore || (bestScore && seconds < bestScore)) {
            localStorage.setItem("bestScore" + boardSize, seconds);
            localStorage.setItem("bestScore" + boardSize + "-Player", txtPlayerName.value);
            return true;
        }
    }

    function setBestScoreElement(score) {
        if (!score)
            score = localStorage.getItem("bestScore" + boardSize);
        if (score) {
            var bestScorePlayer = localStorage.getItem("bestScore" + boardSize + "-Player");
            elBestScore.innerHTML = "Best Score: " + formatTime(score) + " (" + bestScorePlayer + ")";
        }
        else {
            elBestScore.innerHTML = "";
        }
    }

    function updateBestScoreTable() {
        for (let boardSize = MIN_BOARD_SIZE; boardSize <= MAX_BOARD_SIZE; boardSize += 2) {
            // Remove row's highlight if any
            elBestScoreTable.rows[boardSize / 2].classList = "";
            let bestScore = localStorage.getItem("bestScore" + boardSize);
            if (bestScore) {
                elBestScoreTable.rows[boardSize / 2].cells[1].innerHTML = formatTime(bestScore);
                elBestScoreTable.rows[boardSize / 2].cells[2].innerHTML = localStorage.getItem("bestScore" + boardSize + "-Player");
            }
        }

        // Highlight the new best score
        elBestScoreTable.rows[boardSize / 2].classList = "highlight";
    }
    //#endregion Game View

    //#region Helper Functions
    function handleKeydownEvent(key) {
        switch (key) {
            case "Enter":
                switch (_viewType) {
                    case ViewType.Settings:
                        newGame();
                        break;
                    case ViewType.Board:
                        if (isPaused)
                            play();
                        else if (!isPlaying)
                            restart();
                        break;
                    case ViewType.BestScoreTable:
                        setView(ViewType.Board);
                        break;
                    default:
                        break;
                }
                break;
            case "Escape":
                switch (_viewType) {
                    case ViewType.Settings:
                        break;
                    case ViewType.Board:
                        if (isPlaying)
                            pause();
                        else
                            showSettings();
                        break;
                    case ViewType.BestScoreTable:
                        setView(ViewType.Board);
                        break;
                    default:
                        break;
                }
                break;
            default:
                break;
        }
    }

    function initElements() {
        txtBoardSize.min = MIN_BOARD_SIZE;
        txtBoardSize.max = MAX_BOARD_SIZE;
        initBestScoreTable();
    }

    function initGame() {
        resetTimer();
        createGameBoard();
        isPlaying = false;
        isPaused = false;
        elPreviousCard = null;
        flippedCouplesCount = 0;
        btnPlay.style.display = "none";
        btnPause.style.display = "none";
        btnRestart.style.display = "none";
    }

    function setView(viewType) {
        _viewType = viewType;
        setViewControls(viewType);

        [elSettingsPanel, elBoardPanel, elBestScorePanel].forEach(el => el.style.display = "none");

        switch (viewType) {
            case ViewType.Board:
                elBoardPanel.style.display = "";
                break;
            case ViewType.Settings:
                elSettingsPanel.style.display = ""
                initSettingsView();
                break;
            case ViewType.BestScoreTable:
                elBestScorePanel.style.display = "";
                break;
            default:
                break;
        }
    }

    function setViewControls(viewType) {
        switch (viewType) {
            case ViewType.Board:
                gameControls.forEach(el => el.style.display = "");
                setBestScoreElement();
                break;
            case ViewType.Settings:
            case ViewType.BestScoreTable:
                gameControls.forEach(el => el.style.display = "none");
                break;
            default:
                break;
        }
    }

    function initBestScoreTable() {
        for (var boarsSize = MIN_BOARD_SIZE; boarsSize <= MAX_BOARD_SIZE; boarsSize += 2) {
            var row = elBestScoreTable.insertRow();

            var boarsSizeCell = row.insertCell();
            boarsSizeCell.innerHTML = boarsSize;

            row.insertCell();
            row.insertCell();
        }
    }
    //#endregion Helper Functions

    //#region Public API Declaration
    var publicAPI = {
        ViewType: ViewType,
        init: init,
        setView: setView,
        new: newGame,
        play: play,
        pause: pause,
        restart: restart,
        playerNameChanged: playerNameChanged,
        boardSizeChanged: boardSizeChanged,
        cardClicked: cardClicked,
    };

    return publicAPI;
    //#endregion Public API Declaration
})();

document.addEventListener("DOMContentLoaded", function (event) {
    game.init();
});