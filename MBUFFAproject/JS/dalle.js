class Slab extends Rect{
    /* Classe Slab qui hérite de WALLS,
        -une méthode @openDoor() qui permet d'ouvrir la porte
        -un paramètre @resistance pour savoir le nombre de zombies nécessaire à faire chuter la porte
        -un paramètre @linkedDoor pour savoir quelle porte est ouverte par la dalle concernée
    */
    constructor(color, context, resistance, linkedDoor){
        var x = linkedDoor.x;
        var y = linkedDoor.y;
        var squareSize;
        // permet de créer une dalle carrée qui a pour côté la longeur de la porte
        // si height > width --> on est sur droite ou gauche
        //  donc longeur = hauteur de la porte, sinon longeur = épaisseur de la porte
        if(linkedDoor.height > linkedDoor.width){
            squareSize = linkedDoor.height;
        }else{
            squareSize = linkedDoor.width;
        }
        /* permet de créer la dalle en dehors de la forteresse pour les cas north et east
            où x OU y = 0 
        */
        if(x == 0){
            x = -linkedDoor.height;
        }else if(y == 0){
            y = -linkedDoor.width;
        }
        super(x,y,squareSize,squareSize,color, context);
        this.resistance = resistance;
        this.linkedDoor = linkedDoor;
    }
    isInside(unZombi){
        var X = this.x + cWidth/4;
        var Y = this.y + cHeight/4;
        var bool = false;
        if(unZombi.x >= X && unZombi.x <= X + this.width){
            if(unZombi.y >= Y && unZombi.y <= Y + this.height){
                bool = true;
            }
        }
        return bool;
    }
    checkCapacity(listZombis){
        var nb = 0;
        listZombis.forEach(unZombi => {
            if(this.isInside(unZombi)){
                nb++;
            }
        });
        return nb;
    }
    draw() {
        context.save();
        context.strokeStyle = this.color;
        context.translate(cWidth/4, cHeight/4);
        context.strokeRect(this.x, this.y, this.width, this.height);
        context.restore();
    }
}