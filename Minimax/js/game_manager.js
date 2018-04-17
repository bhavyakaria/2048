function GameManager(size, InputManager, Actuator, StorageManager) {
  this.size           = size; // Size of the grid
  this.inputManager   = new InputManager;
  this.storageManager = new StorageManager;
  this.actuator       = new Actuator;

  this.startTiles     = 2;

  this.inputManager.on("move", this.move.bind(this));
  this.inputManager.on("restart", this.restart.bind(this));
  this.inputManager.on("keepPlaying", this.keepPlaying.bind(this));

  this.setup();
}

// Restart the game
GameManager.prototype.restart = function () {
  this.storageManager.clearGameState();
  this.actuator.continueGame(); // Clear the game won/lost message
  this.setup();
};

// Keep playing after winning (allows going over 2048)
GameManager.prototype.keepPlaying = function () {
  this.keepPlaying = true;
  this.actuator.continueGame(); // Clear the game won/lost message
};

// Return true if the game is lost, or has won and the user hasn't kept playing
GameManager.prototype.isGameTerminated = function () {
  return this.over || (this.won && !this.keepPlaying);
};

// Set up the game
GameManager.prototype.setup = function () {
  var previousState = this.storageManager.getGameState();

  // Reload the game from a previous game if present
  if (previousState) {
    this.grid        = new Grid(previousState.grid.size,
                                previousState.grid.cells); // Reload grid
    this.score       = previousState.score;
    this.over        = previousState.over;
    this.won         = previousState.won;
    this.keepPlaying = previousState.keepPlaying;
  } else {
    this.grid        = new Grid(this.size);
    this.score       = 0;
    this.over        = false;
    this.won         = false;
    this.keepPlaying = false;

    // Add the initial tiles
    this.addStartTiles();
  }

  // Update the actuator
  this.actuate();
};

// Set up the initial tiles to start the game with
GameManager.prototype.addStartTiles = function () {
  for (var i = 0; i < this.startTiles; i++) {
    this.addRandomTile();
  }
};

// Adds a tile in a random position
GameManager.prototype.addRandomTile = function () {
  if (this.grid.cellsAvailable()) {
    var value = Math.random() < 0.9 ? 2 : 4;
    var tile = new Tile(this.grid.randomAvailableCell(), value);

    this.grid.insertTile(tile);
  }
};

// Sends the updated grid to the actuator
GameManager.prototype.actuate = function () {
  if (this.storageManager.getBestScore() < this.score) {
    this.storageManager.setBestScore(this.score);
  }

  // Clear the state when the game is over (game over only, not win)
  if (this.over) {
    this.storageManager.clearGameState();
  } else {
    this.storageManager.setGameState(this.serialize());
  }

  this.actuator.actuate(this.grid, {
    score:      this.score,
    over:       this.over,
    won:        this.won,
    bestScore:  this.storageManager.getBestScore(),
    terminated: this.isGameTerminated()
  });

};

// Represent the current game as an object
GameManager.prototype.serialize = function () {
  return {
    grid:        this.grid.serialize(),
    score:       this.score,
    over:        this.over,
    won:         this.won,
    keepPlaying: this.keepPlaying
  };
};

// Save all tile positions and remove merger info
GameManager.prototype.prepareTiles = function () {
  this.grid.eachCell(function (x, y, tile) {
    if (tile) {
      tile.mergedFrom = null;
      tile.savePosition();
    }
  });
};

// Move a tile and its representation
GameManager.prototype.moveTile = function (tile, cell) {
  this.grid.cells[tile.x][tile.y] = null;
  this.grid.cells[cell.x][cell.y] = tile;
  tile.updatePosition(cell);
};

// Move tiles on the grid in the specified direction
GameManager.prototype.move = function (direction) {
  // 0: up, 1: right, 2: down, 3: left
  var self = this;

  if (this.isGameTerminated()) return; // Don't do anything if the game's over

  var cell, tile;

  var vector     = this.getVector(direction);
  var traversals = this.buildTraversals(vector);
  var moved      = false;

  // Save the current tile positions and remove merger information
  this.prepareTiles();

  // Traverse the grid in the right direction and move tiles
  traversals.x.forEach(function (x) {
    traversals.y.forEach(function (y) {
      cell = { x: x, y: y };
      tile = self.grid.cellContent(cell);

      if (tile) {
        var positions = self.findFarthestPosition(cell, vector);
        var next      = self.grid.cellContent(positions.next);

        // Only one merger per row traversal?
        if (next && next.value === tile.value && !next.mergedFrom) {
          var merged = new Tile(positions.next, tile.value * 2);
          merged.mergedFrom = [tile, next];

          self.grid.insertTile(merged);
          self.grid.removeTile(tile);

          // Converge the two tiles' positions
          tile.updatePosition(positions.next);

          // Update the score
          self.score += merged.value;

          // The mighty 2048 tile
          if (merged.value === 2048) self.won = true;
        } else {
          self.moveTile(tile, positions.farthest);
        }

        if (!self.positionsEqual(cell, tile)) {
          moved = true; // The tile moved from its original cell!
        }
      }
    });
  });

  if (moved) {
    this.addRandomTile();

    if (!this.movesAvailable()) {
      this.over = true; // Game over!
    }

    this.actuate();
  }
  /**********************************************/
  /**********************************************/
  /*                AI CODE BEGINS              */
  /**********************************************/
  /**********************************************/
  /*  
    0:Up 
    1:Right 
    2:Down  
    3:Left 
  */
self.panic = false;
this.isValid = function(x,y){
  if(x < 0 || x >3 || y <0 || y > 3)
    return false;
  return true;
}  
this.moveCells = function(matrix, move){
  var dx = [-1,0,1,0];
  var dy = [0,1,0,-1];
  var nx,ny;
  for(var k = 0;k<3;k++){
    for(var i = 0;i<4;i++){
      for(var j = 0; j<4; j++){
       nx = i+dx[move];
       ny = j+dy[move];
       if(self.isValid(nx,ny)){
          if(matrix[nx][ny] == 0){
           matrix[nx][ny] = matrix[i][j];
           matrix[i][j] = 0;
         }
        }
      }
    }
  }
  for(var i = 0;i<4;i++){
      for(var j = 0; j<4; j++){
        nx = i + dx[move];
        ny = j + dy[move];
        if(self.isValid(nx,ny)){
          if(matrix[i][j] == matrix[nx][ny]){
            matrix[nx][ny] *= -2;
            matrix[i][j] = 0;
          }
        }
      }
    }
    for(var k = 0;k<3;k++){
    for(var i = 0;i<4;i++){
      for(var j = 0; j<4; j++){
        if(matrix[i][j] <0)
          matrix[i][j] *= -1;
        nx = i+dx[move];
        ny = j+dy[move];
        if(self.isValid(nx,ny)){
          if(matrix[nx][ny] == 0){
           matrix[nx][ny] = matrix[i][j];
           matrix[i][j] = 0;
          }
        }
      }
    }
  }
  return matrix;
}
this.traverseScore = function(loc, sum, matrix, len){
   var dx = [-1,0,1,0];
   var dy = [0,1,0,-1];
   sum += matrix[loc.x][loc.y];
   var maxVal = {len:len, sum:sum},val;
   for(var i = 0;i<4;i++){
    if(self.isValid(loc.x + dx[i], loc.y+ dy[i])){
      if(2*matrix[loc.x+dx[i]][loc.y+dy[i]] == matrix[loc.x][loc.y] ){
        val = self.traverseScore({x:loc.x+dx[i], y:loc.y+dy[i]}, sum, matrix,len+1);
        if(val.len > maxVal.len)
          maxVal = val;
      }
    }
   }
   return maxVal;
}

this.traverseDecreasingScore = function(loc, sum, matrix, len){
  var dx = [-1,0,1,0];
   var dy = [0,1,0,-1];
   sum += matrix[loc.x][loc.y];
   var maxVal = {len:len, sum:sum},val;
   for(var i = 0;i<4;i++){
    if(self.isValid(loc.x + dx[i], loc.y+ dy[i])){
      if(matrix[loc.x+dx[i]][loc.y+dy[i]] < matrix[loc.x][loc.y] ){
        val = self.traverseDecreasingScore({x:loc.x+dx[i], y:loc.y+dy[i]}, sum, matrix,len+1);
        if(val.len > maxVal.len)
          maxVal = val;
      }
    }
   }
   return maxVal;
}

this.freeCellCount = function(matrix){
  var ret = 0;
  for(var i = 0;i<4;i++)
    for(var j = 0;j<4;j++)
      if(matrix[i][j] == 0)
        ret++;
  return ret;
}

this.traverseCorner = function(matrix, idx){
  var co = [{x:0,y:0},{x:0,y:3},{x:3,y:3},{x:3,y:0}];
  var dx = [[0,1,0,-1],[1,0,-1,0]];
  var dy = [[1,0,-1,0],[0,-1,0,1]];
  var sum=matrix[co[idx].x][co[idx].y],len = 1,ret;
  for(var j = 0;j<2;j++){
    for(var i = 1;i<4;i++){
      ret = {len:len, sum:sum};
      if(matrix[co[idx].x + i*dx[j][idx]][co[idx].y+ i*dy[j][idx]] < matrix[co[idx].x+(i-1)*dx[j][idx]][co[idx].y + (i-1)*dy[j][idx]]){
        len++
        sum += matrix[co[idx].x + i*dx[j][idx]][co[idx].y+ i*dy[j][idx]];
      }
    }
  }
  if(sum > ret.sum){
    ret.len = len;
    ret.sum = sum;
  }
  return ret;
}

this.evaluateMatrix = function(matrix){
  var cc = 0;
  var sum = 0;
  var zc = 0;
  var largest=0;
  var dx = [-1,0,1,0,1,1,-1,-1];
  var dy = [0,1,0,-1,1,-1,1,-1];
  var LIMIT = 64;
  var val;
  for(var i = 0;i<4;i++)
    for(var j = 0;j<4;j++){
      sum += matrix[i][j];
      if(matrix[i][j] == 0)
          zc++;    
      else {
          if(matrix[i][j] > largest)
            largest = matrix[i][j];
          cc += matrix[i][j]*matrix[i][j]*Math.sqrt(Math.sqrt(matrix[i][j]));
          val = self.traverseScore({x:i, y:j}, 0, matrix, 1);
          cc += Math.pow(2, val.len-1 ) + (val.sum);
        }
    }
    cc += zc * sum;
    var corners = [{x:0,y:0},{x:0,y:3},{x:3,y:3},{x:3,y:0}];
    var inCorner = false;
    var ii = 0,cornerIDX;
    for(;ii<4;ii++)
      if(matrix[corners[ii].x][corners[ii].y] == largest){
        inCorner = true;
        cornerIDX = ii;  
      }
    if(inCorner == true){
      val = self.traverseCorner(matrix,cornerIDX);
      cc += largest*val.sum;
    }
    
    var linearSeq;
    var jk = [1,2,1,2];
    var dj = [1,-1,1,-1];
    var cj = [-1,1,-1,1]
    for(var k = 0;k<4;k++){
      for(var i = 0;i<4 && i >=0;i++){
        linearSeq = true;
        for(var j = jk[k];j >= 0 && j<4;j += dj[k]){
          if(k < 2){
            if(matrix[i][j+cj[k]]*2 != matrix[i][j])
              linearSeq = false;
          }
          else {
            if(matrix[j+cj[k]][i]*2 != matrix[j][i])
              linearSeq = false;
          }
        }


        if(linearSeq){
          var mul = 10;
          if(i == 0 || i == 3)
            mul = 70;
          if(k == 0){
            cc += matrix[i][3]*mul*Math.sqrt(matrix[i][3]);
            if(matrix[i][3] == largest)
              cc += largest*Math.sqrt(largest);
          }
          else if(k == 1){
            cc += matrix[i][0]*mul*Math.sqrt(matrix[i][0]);
             if(matrix[i][0] == largest)
              cc += largest*Math.sqrt(largest);
          }
          else if(k == 2){
            cc += matrix[3][i]*mul*Math.sqrt(matrix[3][i]);
             if(matrix[3][i] == largest)
              cc += largest*Math.sqrt(largest);
          }
          else {
            cc += matrix[0][i]*mul*Math.sqrt(matrix[0][i]);
            if(matrix[0][i] == largest)
              cc += largest*Math.sqrt(largest);
          }
        }
      }
    }
    return cc;
}

/* Print the entire Grid */
this.printMatrix = function(matrix){
  for(var i = 0;i<4;i++){
    var str = ""
    for(var j = 0;j<4;j++)
      str += matrix[i][j] + " ";
    console.log(str)
  }
  console.log("******************************");
}

/* Get location of the largest grid cell */
this.getLargestLocation = function(matrix){
  var lar = 0;
  var ret = ({x:0,y:0});
  for(var i = 0; i < 4;i++){
    for(var j = 0;j<4;j++){
      if(matrix[i][j] > lar){
        lar = matrix[i][j];
        ret = ({x:i, y:j});
      }
    }
  }
  return ret;
}

/* Function to find a free Cell in the Grid */
this.findFreeCell = function(matrix){
  var ret = [];
  var i,j,k=0;
  var xx = ((Math.floor(Math.random()*100))%10)==9?4:2;
  do{
    i =  (Math.floor(Math.random()*100))%4;
    j =  (Math.floor(Math.random()*100))%4;
    k++;
  }while(matrix[i][j] != 0 && k != 64);

  if(matrix[i][j] != 0)
    for(i = 0;i<4;i++)
      for(j = 0;j<4;j++)
        if(matrix[i][j] == 0){
          ret.push({x:i, y:j, z:xx});
          return ret;
        }
  ret.push({x:i, y:j, z:xx});
  return ret;
}

/* Function to check if matrix m1 is equal to matrix m2 */
this.isEqualMatrix = function(m1,m2){
  for(var i = 0;i<4;i++)
    for(var j = 0;j<4;j++)
      if(m1[i][j] != m2[i][j])
        return false;
  return true;
}

this.minMax = function(matrix, move, depth){
  var maxVal=-1000000000000000,val,ret;
  var rmatrix   = self.moveCells(self.createCopy(matrix),move);
  var areSame   = self.isEqualMatrix(rmatrix, matrix);
  var score     = self.evaluateMatrix(rmatrix);
  if(areSame == true || depth == 7)
    return score;
  var freeCellMatrix = self.findFreeCell(rmatrix);
  for(var i = 0;i<freeCellMatrix.length;i++)
    rmatrix[freeCellMatrix[i].x][freeCellMatrix[i].y] = freeCellMatrix[i].z;  
    
  for(var x = 0;x<4;x++)
  {
   val =this.minMax(self.createCopy(rmatrix), x, depth+1);
   if(val > maxVal)
     maxVal  = val;
  }
  return (score + maxVal);
}

  this.getMove = function(matrix){
    var maxVal = -1000000000000000,val,ret;
    var freeCells = self.freeCellCount(matrix);
    for(var x = 0; x < 4;x++){
      val = this.minMax(self.createCopy(matrix),x,0);
      if(val > maxVal){
        maxVal = val;
        ret = x;
      }
    }
    return ret;
  }
  
  /* Retreive the entire matrix */
  this.getMatrix = function(){
    var matrix = [];
    for (var i = 0 ; i <4 ; i++) {
      var row = [];
      for (var j = 0; j < 4; j++) {
        tile = self.grid.cellContent({x:j, y:i});
        if(tile == null)
          row.push(0);
        else 
          row.push(tile["value"]);
      };
      matrix.push(row);
    };
    return matrix;
  }

  /* Create a copy of the matrix */
  this.createCopy = function(matrix){
    var ret =[[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
    for(var i = 0; i < 4;i++)
      for(var j = 0; j < 4; j++)
        ret[i][j] = matrix[i][j].valueOf();
    return ret;
  }

  

 
  setTimeout(function() {
    matrix = self.getMatrix();
    var myMove = self.getMove(self.createCopy(matrix));
    var rmat = self.moveCells(self.createCopy(matrix), myMove);
   // console.log(myMove);
    if( self.isEqualMatrix(rmat,matrix))
      myMove = (Math.floor(Math.random()*100))%4;
    self.move(myMove);
  }, 1);
  /**********************************************/
  /**********************************************/
  /*                AI CODE END                 */
  /**********************************************/
  /**********************************************/
};

// Get the vector representing the chosen direction
GameManager.prototype.getVector = function (direction) {
  // Vectors representing tile movement
  var map = {
    0: { x: 0,  y: -1 }, // Up
    1: { x: 1,  y: 0 },  // Right
    2: { x: 0,  y: 1 },  // Down
    3: { x: -1, y: 0 }   // Left
  };

  return map[direction];
};

// Build a list of positions to traverse in the right order
GameManager.prototype.buildTraversals = function (vector) {
  var traversals = { x: [], y: [] };

  for (var pos = 0; pos < this.size; pos++) {
    traversals.x.push(pos);
    traversals.y.push(pos);
  }

  // Always traverse from the farthest cell in the chosen direction
  if (vector.x === 1) traversals.x = traversals.x.reverse();
  if (vector.y === 1) traversals.y = traversals.y.reverse();

  return traversals;
};

GameManager.prototype.findFarthestPosition = function (cell, vector) {
  var previous;

  // Progress towards the vector direction until an obstacle is found
  do {
    previous = cell;
    cell     = { x: previous.x + vector.x, y: previous.y + vector.y };
  } while (this.grid.withinBounds(cell) &&
           this.grid.cellAvailable(cell));

  return {
    farthest: previous,
    next: cell // Used to check if a merge is required
  };
};

GameManager.prototype.movesAvailable = function () {
  return this.grid.cellsAvailable() || this.tileMatchesAvailable();
};

// Check for available matches between tiles (more expensive check)
GameManager.prototype.tileMatchesAvailable = function () {
  var self = this;

  var tile;

  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      tile = this.grid.cellContent({ x: x, y: y });

      if (tile) {
        for (var direction = 0; direction < 4; direction++) {
          var vector = self.getVector(direction);
          var cell   = { x: x + vector.x, y: y + vector.y };

          var other  = self.grid.cellContent(cell);

          if (other && other.value === tile.value) {
            return true; // These two tiles can be merged
          }
        }
      }
    }
  }

  return false;
};

GameManager.prototype.positionsEqual = function (first, second) {
  return first.x === second.x && first.y === second.y;
};
