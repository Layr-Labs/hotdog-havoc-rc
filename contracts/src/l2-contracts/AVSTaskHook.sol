// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IAVSTaskHook} from "@eigenlayer-contracts/src/contracts/interfaces/IAVSTaskHook.sol";
import {ITaskMailboxTypes} from "@eigenlayer-contracts/src/contracts/interfaces/ITaskMailbox.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

using EnumerableSet for EnumerableSet.UintSet;

////////////////////////////////////////////////////////////
// Hotdog Havoc
//
// This contract is the main contract for the Hotdog Havoc game.
// It is responsible for creating and managing levels, teams, and games.
//
// Each map is a 200x100 grid of blocks. Each block is 16x16 pixels.
//
////////////////////////////////////////////////////////////
contract AVSTaskHook is IAVSTaskHook {
    ////////////////////////////////////////////////////////////
    // Block
    //
    // A block is a 16x16 square on the map. It is represented by the grid
    // space in the world, which is 200x100 max. 
    ////////////////////////////////////////////////////////////
    struct Block {
        uint8 x;
        uint8 y;
    }

    ////////////////////////////////////////////////////////////
    // Level
    //
    // A level is a 2D grid of blocks that represent the topology of the level.
    ////////////////////////////////////////////////////////////
    struct Level {
        uint256 id;        // this will increase each time a new level is created
        address owner;     // the addressed of the owner who created the level
        string name;       // a human readable name for the level
        Block[] map;       // an array of sparse blocks that represent the topology
    }

    ////////////////////////////////////////////////////////////
    // Team
    //
    // Each wallet has a team of 3 hotdogs - with unique names.
    ////////////////////////////////////////////////////////////
    struct Team {
        string[] names;
    }

    ////////////////////////////////////////////////////////////
    // HotDog
    //
    // A hotdog represents a player's character in the game. Each hotdog has
    // a life value, a position on the map, and an ID that refers to the
    // name in the team's names array.
    ////////////////////////////////////////////////////////////
    struct HotDog {
        uint8 life;        // the current life/health of the hotdog
        Block position;    // the current position of the hotdog on the map
        uint8 hotdog_id;   // the ID that refers to the name in the team's names array
    }

    ////////////////////////////////////////////////////////////
    // GameState
    //
    // Enum representing the current state of a game.
    ////////////////////////////////////////////////////////////
    enum GameState {
        PENDING,    // game is created but not yet started
        PLACING,    // players are placing their hotdogs on the map
        ACTIVE,     // game is actively being played
        COMPLETE    // game has finished
    }

    ////////////////////////////////////////////////////////////
    // Game
    //
    // A game represents an active match between players. It contains
    // all the information needed to track the game state, including
    // player addresses, wager amount, level, destroyed blocks, hotdogs,
    // and processed tasks.
    ////////////////////////////////////////////////////////////
    struct Game {
        address[] players;                      // array of player addresses participating in the game
        uint256 wagerAmount;                    // the amount wagered for this game
        uint256 levelId;                        // the ID of the level being played
        Block[] destroyedBlocks;                // list of blocks that have been destroyed during the game
        mapping(address => HotDog[]) hotdogs;   // mapping of player address to their array of hotdogs
        bytes32[] tasks;                        // array of task IDs processed by the AVS for each turn
        address activePlayer;                   // the address of the player whose turn it currently is
        GameState state;                        // the current state of the game
        bool isPrivate;                         // whether the game can be joined by anyone other than current players
    }

    ////////////////////////////////////////////////////////////
    // STORAGE
    ////////////////////////////////////////////////////////////
    address public taskMailbox;                          // the address where all of our offchain tasks go
    
    mapping(uint256 => Level) public levels;              // index of all levels
    mapping(address => uint256[]) private ownerLevels;    // index of all levels owned by an address
    mapping(address => Team) private teams;               // index of the team owned by an address
    uint256 public levelCount = 0;                        // total number of levels created
    uint256 public blockCount = 0;                        // total number of blocks created

    // Game storage
    mapping(uint256 => Game) public games;                       // index of all games by game ID
    uint256 public gameCount = 0;                                // total number of games created
    mapping(address => EnumerableSet.UintSet) private userGames; // games that a user is a player of

    ////////////////////////////////////////////////////////////
    // SETTING TASK MAILBOX
    ////////////////////////////////////////////////////////////
    function setTaskMailbox(address mailbox) public {
        require(taskMailbox == address(0));
        taskMailbox = mailbox;
    }

    ////////////////////////////////////////////////////////////
    // EVENTS
    ////////////////////////////////////////////////////////////
    event LevelCreated(uint256 indexed levelId, address indexed owner, string name);
    event GameCreated(uint256 indexed gameId, address indexed creator, uint256 levelId, uint256 wagerAmount, address[] players);

    ////////////////////////////////////////////////////////////
    // IAVSTaskHook INTERFACE IMPLEMENTATION
    ////////////////////////////////////////////////////////////
    function validatePreTaskCreation(
        address, /*caller*/
        ITaskMailboxTypes.TaskParams memory /*taskParams*/
    ) external view {
        //TODO: Implement
    }

    function handlePostTaskCreation(
        bytes32 /*taskHash*/
    ) external {
        //TODO: Implement
    }

    function validatePreTaskResultSubmission(
        address, /*caller*/
        bytes32, /*taskHash*/
        bytes memory, /*cert*/
        bytes memory /*result*/
    ) external view {
        //TODO: Implement
    }

    function handlePostTaskResultSubmission(
        address, /*caller*/
        bytes32 /*taskHash*/
    ) external {
        //TODO: Implement
    }

    function calculateTaskFee(
        ITaskMailboxTypes.TaskParams memory /*taskParams*/
    ) external view returns (uint96) {
        //TODO: Implement
    }

    ////////////////////////////////////////////////////////////
    // GAME FUNCTIONS
    ////////////////////////////////////////////////////////////
    /**
     * @notice Creates a new level with the given name and block map
     * @dev This function creates a new level and assigns it a unique ID. The level is stored
     *      in the levels mapping and indexed by the owner's address. The function emits a
     *      LevelCreated event upon successful creation.
     * @param name The human-readable name for the level
     * @param map An array of Block structs representing the level's topology
     * @return levelId The unique identifier of the newly created level
     * @custom:security This function is public and can be called by anyone. 
     */
    function createLevel(string memory name, Block[] memory map) public returns (uint256 levelId) {
        // Increment the level counter to get the new level ID
        levelId = levelCount++;

        // Create empty level and assign fields manually
        Level storage newLevel = levels[levelId];
        newLevel.id = levelId;
        newLevel.owner = msg.sender;
        newLevel.name = name;

        for (uint256 i = 0; i < map.length; i++) {
            newLevel.map.push(Block({
                x: map[i].x,
                y: map[i].y
            }));
        }

        // Add the level to the owner's index
        ownerLevels[msg.sender].push(levelId);

        // Emit the creation event
        emit LevelCreated(levelId, msg.sender, name);

        return levelId;
    }

    /**
     * @notice Returns an array of level IDs owned by the specified address
     * @param owner The address to get level IDs for
     * @return An array of level IDs owned by the address
     */
    function getOwnerLevels(address owner) public view returns (uint256[] memory) {
        return ownerLevels[owner];
    }

    /**
     * @notice Returns the array of hotdog names for a specific address's team
     * @dev This function retrieves the team names for a given address from the teams mapping.
     *      If the address has no team, it will return an empty array.
     * @param player The address to get team names for
     * @return An array of strings containing the hotdog names in the player's team
     * @custom:security This function is public and can be called by anyone to view any address's team names
     */
    function getTeamNames(address player) public view returns (string[] memory) {
        return teams[player].names;
    }

    /**
     * @notice Sets the team names for the caller's team
     * @dev This function allows a player to set their team's hotdog names.
     *      The function requires exactly 4 names to be provided in the array.
     *      Each name must be non-empty.
     *      The function will revert if any of these conditions are not met.
     * @param names Array of exactly 4 hotdog names for the team
     * @custom:security This function can only be called by the team owner
     * @custom:security This function will revert if array length is not 4 or if any name is empty
     */
    function setTeamNames(string[] memory names) public {
        // Validate array length
        require(names.length == 4, "Must provide exactly 4 names");

        // Validate that all names are non-empty
        for (uint i = 0; i < 4; i++) {
            require(bytes(names[i]).length > 0, string(abi.encodePacked("Name ", i + 1, " cannot be empty")));
        }

        // Set the team names
        teams[msg.sender].names = names;
    }

    /**
     * @notice Returns the array of Block structs for a given level ID
     * @dev This function allows external callers to retrieve the full block map for a level.
     *      It is necessary because Solidity's public getter for structs containing dynamic arrays
     *      does not return the entire array, only individual elements by index.
     * @param levelId The ID of the level to retrieve blocks for
     * @return An array of Block structs representing the level's map
     */
    function getLevelBlocks(uint256 levelId) public view returns (Block[] memory) {
        return levels[levelId].map;
    }

    /**
     * @notice Creates a new game with the specified level, wager amount, and players
     * @dev This function creates a new game and assigns it a unique ID. The game is stored
     *      in the games mapping and indexed by the creator's address. The function adds the
     *      caller and any provided players to the game's player list.
     * @param levelId The ID of the level to play
     * @param wagerAmount The amount to wager for this game
     * @param players Array of additional player addresses to add to the game (can be empty)
     * @return gameId The unique identifier of the newly created game
     * @custom:security This function is public and can be called by anyone
     */
    function createGame(uint256 levelId, uint256 wagerAmount, address[] memory players) public payable returns (uint256 gameId) {
        // Validate that the level exists
        require(levelId < levelCount, "Level does not exist");
        
        // Validate wager amount is greater than 0
        require(wagerAmount > 0, "Wager amount must be greater than 0");
        
        // Validate that the caller has sent at least the wager amount
        require(msg.value >= wagerAmount, "Insufficient wager amount sent");

        // Increment the game counter to get the new game ID
        gameId = gameCount++;

        // Create the new game
        Game storage newGame = games[gameId];
        
        // Initialize game properties
        newGame.wagerAmount = wagerAmount;
        newGame.levelId = levelId;
        newGame.activePlayer = msg.sender; // Set creator as first active player
        newGame.state = GameState.PENDING;
        newGame.isPrivate = players.length > 0; // Private if specific players are provided

        // Add the creator to the players array
        newGame.players.push(msg.sender);
        
        // Add any provided players to the game
        for (uint256 i = 0; i < players.length; i++) {
            newGame.players.push(players[i]);
        }

        // Add the game to each player's userGames set
        for (uint256 i = 0; i < newGame.players.length; i++) {
            userGames[newGame.players[i]].add(gameId);
        }

        // Emit the creation event
        emit GameCreated(gameId, msg.sender, levelId, wagerAmount, newGame.players);

        return gameId;
    }
}
