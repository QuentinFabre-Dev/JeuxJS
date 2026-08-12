class Door extends Rect{
    /* Classe DOOR qui hérite de WALLS,
        -elle possède l'attribut supplémentaire "passable"
        qui permet de savoir si elle franchissable
        -une méthode qui permet de la passer en mode franchissable (c.f switchState())
        --> De base "passable" était dans Walls mais je trouvait ça bizarre
            étant donné que les autres murs "devrait" ne jamais être franchissable
            (à voir avec ce qu'on veut implanter par la suite...)
    */
    constructor(x, y, width, height, color, context){
        super(x, y, width, height, color, context);
        this.passable = false;
    }
    switchState(){
        this.passable = !this.passable;
      }
}