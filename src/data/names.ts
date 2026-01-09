/**
 * Nationality-Based Name Pools
 *
 * Contains first and last name pools for all 30 nationalities.
 * Each pool has 50+ names to provide 2,500+ unique combinations.
 *
 * Name sources: Common surnames from census data, popular first names
 * from national statistics offices.
 *
 * @module data/names
 */

export interface NamePool {
  firstNames: string[];
  lastNames: string[];
}

/**
 * Name pools indexed by nationality string (matches NATIONALITIES array in types.ts)
 */
export const NAME_POOLS: Record<string, NamePool> = {
  // =============================================================================
  // NORTH AMERICA
  // =============================================================================
  'American': {
    firstNames: [
      'James', 'Michael', 'Marcus', 'Anthony', 'Christopher', 'David', 'Robert', 'John', 'Daniel', 'William',
      'Kevin', 'Brandon', 'Justin', 'Ryan', 'Tyler', 'Joshua', 'Andrew', 'Matthew', 'Eric', 'Jason',
      'Derrick', 'Patrick', 'Brian', 'Steven', 'Aaron', 'Darius', 'Terrence', 'DeShawn', 'Malik', 'Jamal',
      'Trevon', 'Quincy', 'Rashad', 'DeAndre', 'Tyrone', 'Lamar', 'Cedric', 'Dominique', 'Xavier', 'Jalen',
      'Jaylen', 'Cameron', 'Isaiah', 'Jordan', 'Tre', 'Damian', 'Kyle', 'Zach', 'Cole', 'Austin',
    ],
    lastNames: [
      'Johnson', 'Williams', 'Brown', 'Jones', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson',
      'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Garcia', 'Martinez', 'Robinson', 'Clark',
      'Rodriguez', 'Lewis', 'Lee', 'Walker', 'Hall', 'Allen', 'Young', 'King', 'Wright', 'Scott',
      'Green', 'Baker', 'Adams', 'Nelson', 'Hill', 'Ramirez', 'Campbell', 'Mitchell', 'Roberts', 'Carter',
      'Phillips', 'Evans', 'Turner', 'Torres', 'Parker', 'Collins', 'Edwards', 'Stewart', 'Flores', 'Morris',
    ],
  },

  'Canadian': {
    firstNames: [
      'Liam', 'Noah', 'Ethan', 'Lucas', 'Benjamin', 'Oliver', 'Jacob', 'William', 'Alexander', 'James',
      'Ryan', 'Connor', 'Tyler', 'Nathan', 'Dylan', 'Justin', 'Brandon', 'Kyle', 'Jordan', 'Matthew',
      'Andrew', 'Joshua', 'Daniel', 'Michael', 'David', 'Samuel', 'Owen', 'Mason', 'Logan', 'Aiden',
      'Tristan', 'Cody', 'Brett', 'Derek', 'Evan', 'Austin', 'Hunter', 'Cole', 'Blake', 'Cameron',
      'Jamal', 'Khem', 'Cory', 'Steve', 'Rick', 'Vince', 'Dillon', 'Nik', 'Shai', 'Luguentz',
    ],
    lastNames: [
      'Smith', 'Brown', 'Wilson', 'Johnson', 'Williams', 'Jones', 'Miller', 'Davis', 'Martin', 'Anderson',
      'Taylor', 'Thomas', 'Moore', 'White', 'Thompson', 'Campbell', 'Robinson', 'Clark', 'Lewis', 'Lee',
      'Walker', 'Hall', 'Young', 'King', 'Wright', 'Scott', 'Green', 'Baker', 'Adams', 'Nelson',
      'Mitchell', 'Roberts', 'Carter', 'Turner', 'Phillips', 'Murray', 'Tremblay', 'Gagnon', 'Roy', 'Bouchard',
      'Gauthier', 'Morin', 'Lavoie', 'Fortin', 'Cote', 'Bergeron', 'Pelletier', 'Alexander', 'Wiggins', 'Barrett',
    ],
  },

  'Mexican': {
    firstNames: [
      'Juan', 'Carlos', 'Miguel', 'Jose', 'Luis', 'Francisco', 'Antonio', 'Jorge', 'Pedro', 'Manuel',
      'Alejandro', 'Ricardo', 'Fernando', 'Eduardo', 'Roberto', 'Diego', 'Rafael', 'Sergio', 'Enrique', 'Pablo',
      'Andres', 'Javier', 'Raul', 'Oscar', 'Hector', 'Adrian', 'Marco', 'Gustavo', 'Ruben', 'Victor',
      'Angel', 'Arturo', 'Mario', 'Gerardo', 'Alfredo', 'Daniel', 'Alberto', 'Cesar', 'Ivan', 'Hugo',
      'Guillermo', 'Salvador', 'Ramon', 'Emmanuel', 'Rodrigo', 'Gabriel', 'Felipe', 'Ernesto', 'Ismael', 'Orlando',
    ],
    lastNames: [
      'Garcia', 'Rodriguez', 'Martinez', 'Lopez', 'Gonzalez', 'Hernandez', 'Perez', 'Sanchez', 'Ramirez', 'Torres',
      'Flores', 'Rivera', 'Gomez', 'Diaz', 'Cruz', 'Morales', 'Reyes', 'Gutierrez', 'Ortiz', 'Ramos',
      'Chavez', 'Ruiz', 'Vargas', 'Mendoza', 'Castillo', 'Jimenez', 'Romero', 'Herrera', 'Medina', 'Aguilar',
      'Vega', 'Castro', 'Fernandez', 'Vasquez', 'Munoz', 'Rojas', 'Soto', 'Contreras', 'Silva', 'Delgado',
      'Sandoval', 'Guerrero', 'Rios', 'Estrada', 'Ortega', 'Nunez', 'Fuentes', 'Campos', 'Espinoza', 'Salazar',
    ],
  },

  // =============================================================================
  // SOUTH AMERICA
  // =============================================================================
  'Brazilian': {
    firstNames: [
      'Lucas', 'Gabriel', 'Matheus', 'Pedro', 'Rafael', 'Guilherme', 'Felipe', 'Bruno', 'Leonardo', 'Gustavo',
      'Anderson', 'Leandro', 'Thiago', 'Vinicius', 'Henrique', 'Marcelo', 'Carlos', 'Eduardo', 'Fernando', 'Rodrigo',
      'Diego', 'Cristiano', 'Alex', 'Caio', 'Joao', 'Andre', 'Paulo', 'Ricardo', 'Fabio', 'Sergio',
      'Marcos', 'Raul', 'Davi', 'Igor', 'Victor', 'Enzo', 'Bernardo', 'Arthur', 'Murilo', 'Otavio',
      'Renan', 'Danilo', 'Neymar', 'Ronaldo', 'Romario', 'Rivaldo', 'Kaka', 'Juninho', 'Robinho', 'Hulk',
    ],
    lastNames: [
      'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes',
      'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Almeida', 'Lopes', 'Soares', 'Fernandes', 'Vieira', 'Barbosa',
      'Rocha', 'Dias', 'Nascimento', 'Andrade', 'Moreira', 'Nunes', 'Marques', 'Machado', 'Mendes', 'Freitas',
      'Cardoso', 'Ramos', 'Goncalves', 'Santana', 'Teixeira', 'Castro', 'Araujo', 'Pinto', 'Correia', 'Moura',
      'Azevedo', 'Campos', 'Neto', 'Junior', 'Filho', 'Batista', 'Melo', 'Cunha', 'Nogueira', 'Varejao',
    ],
  },

  'Argentine': {
    firstNames: [
      'Juan', 'Martin', 'Lucas', 'Nicolas', 'Facundo', 'Agustin', 'Matias', 'Leandro', 'Pablo', 'Gonzalo',
      'Diego', 'Emanuel', 'Andres', 'Federico', 'Sebastian', 'Gabriel', 'Carlos', 'Maxi', 'Fernando', 'Marcos',
      'Luis', 'Angel', 'Cristian', 'Ezequiel', 'Sergio', 'Lionel', 'Javier', 'Rodrigo', 'Bruno', 'Julian',
      'Tomas', 'Franco', 'Santiago', 'Ignacio', 'Joaquin', 'Ramiro', 'Ivan', 'Alejandro', 'Mauricio', 'Damian',
      'Mariano', 'Hernan', 'Patricio', 'Gaston', 'Walter', 'Ariel', 'Jorge', 'Luciano', 'Fabricio', 'Ruben',
    ],
    lastNames: [
      'Gonzalez', 'Rodriguez', 'Fernandez', 'Lopez', 'Martinez', 'Garcia', 'Perez', 'Sanchez', 'Romero', 'Gomez',
      'Diaz', 'Torres', 'Alvarez', 'Ruiz', 'Ramirez', 'Flores', 'Acosta', 'Benitez', 'Medina', 'Herrera',
      'Aguirre', 'Pereyra', 'Cabrera', 'Rojas', 'Rios', 'Sosa', 'Ortiz', 'Silva', 'Vargas', 'Castro',
      'Morales', 'Gutierrez', 'Munoz', 'Suarez', 'Gimenez', 'Figueroa', 'Ledesma', 'Molina', 'Peralta', 'Moreno',
      'Scola', 'Ginobili', 'Nocioni', 'Delfino', 'Campazzo', 'Deck', 'Garino', 'Laprovittola', 'Vildoza', 'Brussino',
    ],
  },

  'Venezuelan': {
    firstNames: [
      'Carlos', 'Luis', 'Jose', 'Juan', 'Miguel', 'Pedro', 'Francisco', 'Rafael', 'Andres', 'Antonio',
      'Victor', 'Gabriel', 'Daniel', 'Jesus', 'Angel', 'Diego', 'Fernando', 'Eduardo', 'Oscar', 'Alejandro',
      'Ricardo', 'Jorge', 'Sergio', 'Hector', 'Ramon', 'Manuel', 'Gustavo', 'Roberto', 'Pablo', 'Enrique',
      'Adrian', 'Marco', 'Raul', 'Cesar', 'Ivan', 'Ruben', 'Alberto', 'Hugo', 'Gerardo', 'Alfredo',
      'Guillermo', 'Salvador', 'Orlando', 'Ernesto', 'Ismael', 'Dario', 'Wilfredo', 'Greivis', 'Willy', 'Gregory',
    ],
    lastNames: [
      'Rodriguez', 'Gonzalez', 'Garcia', 'Martinez', 'Lopez', 'Hernandez', 'Perez', 'Ramirez', 'Sanchez', 'Torres',
      'Diaz', 'Morales', 'Reyes', 'Romero', 'Flores', 'Castillo', 'Vargas', 'Mendoza', 'Gutierrez', 'Rojas',
      'Vasquez', 'Castro', 'Jimenez', 'Ortiz', 'Ramos', 'Ruiz', 'Gomez', 'Moreno', 'Herrera', 'Medina',
      'Silva', 'Fernandez', 'Cruz', 'Chavez', 'Vega', 'Rivera', 'Munoz', 'Contreras', 'Delgado', 'Soto',
      'Escalona', 'Vasquez', 'Echenique', 'Betancourt', 'Varela', 'Carrasquilla', 'Mujica', 'Hurtado', 'Arroyo', 'Machado',
    ],
  },

  // =============================================================================
  // CARIBBEAN
  // =============================================================================
  'Dominican': {
    firstNames: [
      'Juan', 'Carlos', 'Pedro', 'Luis', 'Miguel', 'Jose', 'Rafael', 'Francisco', 'Antonio', 'Angel',
      'Victor', 'Roberto', 'Fernando', 'Manuel', 'Eduardo', 'Julio', 'Ramon', 'Hector', 'Alberto', 'Ricardo',
      'Felix', 'Jesus', 'Domingo', 'Wander', 'Vladimir', 'Manny', 'Albert', 'Hansel', 'Starlin', 'Erick',
      'Diory', 'Yoenis', 'Yasmani', 'Yadier', 'Kelvin', 'Adalberto', 'Maikel', 'Eliezer', 'Wilmer', 'Jean',
      'Robinson', 'Nelson', 'Sammy', 'David', 'Moisés', 'Adrián', 'Franchy', 'Jeimer', 'Sandy', 'Al',
    ],
    lastNames: [
      'Rodriguez', 'Martinez', 'Garcia', 'Perez', 'Sanchez', 'Gonzalez', 'Ramirez', 'Hernandez', 'Lopez', 'Torres',
      'Diaz', 'Reyes', 'Cruz', 'Ortiz', 'Castillo', 'Guerrero', 'Rosario', 'Mercedes', 'Pena', 'Santos',
      'Marte', 'Soto', 'Cabrera', 'Pujols', 'Encarnacion', 'De La Cruz', 'Bautista', 'Beltre', 'Cano', 'Valdez',
      'Segura', 'Polanco', 'Franco', 'Familia', 'Batista', 'Heredia', 'Guzman', 'Peralta', 'Taveras', 'Horwitz',
      'Mateo', 'Severino', 'Castilla', 'Feliz', 'Mella', 'Aybar', 'Soriano', 'Tejada', 'Valverde', 'Henriquez',
    ],
  },

  'Puerto Rican': {
    firstNames: [
      'Carlos', 'Luis', 'Jose', 'Juan', 'Miguel', 'Angel', 'Pedro', 'Rafael', 'Francisco', 'Antonio',
      'Victor', 'Roberto', 'Fernando', 'Eduardo', 'Manuel', 'Ricardo', 'Hector', 'Ramon', 'Julio', 'Alberto',
      'Jorge', 'Javier', 'JJ', 'Carmelo', 'Jose Juan', 'Bengie', 'Yadier', 'Ivan', 'Ricky', 'Bernie',
      'Javy', 'Carlos Juan', 'Gary', 'Wil', 'Orlando', 'Felix', 'Hiram', 'Alex', 'Alexis', 'Jonathan',
      'Enrique', 'Gilberto', 'Efren', 'Carlos Arroyo', 'Trevor', 'Isaiah', 'Jose Alvarado', 'Edgar', 'Georgie', 'Tremont',
    ],
    lastNames: [
      'Rodriguez', 'Martinez', 'Garcia', 'Lopez', 'Gonzalez', 'Rivera', 'Torres', 'Ramirez', 'Diaz', 'Cruz',
      'Ortiz', 'Hernandez', 'Perez', 'Sanchez', 'Reyes', 'Morales', 'Colon', 'Vargas', 'Rosario', 'Vega',
      'Ramos', 'Molina', 'Santos', 'Figueroa', 'Medina', 'Rojas', 'Maldonado', 'Berrios', 'Delgado', 'Santiago',
      'Correa', 'Lindor', 'Baez', 'Barea', 'Arroyo', 'Alvarado', 'Clemente', 'Cepeda', 'Bichette', 'Vazquez',
      'Ayala', 'Feliciano', 'Velez', 'Pagan', 'Nieves', 'Soto', 'Aviles', 'Lebron', 'Casiano', 'Oquendo',
    ],
  },

  'Jamaican': {
    firstNames: [
      'Andre', 'Wayne', 'Michael', 'Daniel', 'Anthony', 'Christopher', 'David', 'Kevin', 'Ricardo', 'Omar',
      'Patrick', 'Damion', 'Jermaine', 'Kirk', 'Tyrone', 'Marlon', 'Garfield', 'Donovan', 'Romaine', 'Leroy',
      'Winston', 'Desmond', 'Trevor', 'Lloyd', 'Neville', 'Usain', 'Asafa', 'Yohan', 'Hansle', 'Davion',
      'Tajay', 'Oshane', 'Akeem', 'Kemar', 'Keron', 'Demar', 'Alton', 'Jevaughn', 'Rashid', 'Shaquille',
      'Alonzo', 'Dwayne', 'Rondel', 'Shamar', 'Jalen', 'Romario', 'Jevon', 'Kevon', 'DeLeon', 'Jullian',
    ],
    lastNames: [
      'Williams', 'Brown', 'Campbell', 'Stewart', 'Davis', 'Thomas', 'Robinson', 'Anderson', 'Scott', 'Morgan',
      'Taylor', 'Graham', 'Reid', 'Lewis', 'Walker', 'Clarke', 'Hall', 'Green', 'Martin', 'Wright',
      'Bennett', 'Gordon', 'Richards', 'Edwards', 'Henry', 'Bailey', 'Francis', 'Collins', 'McDonald', 'Lawrence',
      'Bolt', 'Powell', 'Blake', 'Frater', 'Carter', 'Ashmeade', 'Parchment', 'McLeod', 'Gayle', 'Pinnock',
      'Bryan', 'Dacres', 'Levy', 'Wedderburn', 'Murray', 'Barrett', 'Minott', 'McCalla', 'Smellie', 'Simpson',
    ],
  },

  'Bahamian': {
    firstNames: [
      'Buddy', 'Mychal', 'Dexter', 'Tavario', 'Eugene', 'Ian', 'Chavano', 'Magnum', 'Dwight', 'Lavard',
      'Rick', 'Lucius', 'Devaughn', 'Shannon', 'Christopher', 'Michael', 'Anthony', 'David', 'Kevin', 'Andre',
      'Marcus', 'Jamal', 'Tyrone', 'Dwayne', 'Shaquille', 'DeAndre', 'Rashad', 'Terrence', 'Cameron', 'Jaylen',
      'Kendrick', 'Steven', 'Jonathan', 'Patrick', 'Derek', 'Jason', 'Brandon', 'Jerome', 'Ronald', 'Garfield',
      'Winston', 'Lloyd', 'Trevor', 'Neville', 'Clinton', 'Wellington', 'Donnie', 'Mikhail', 'Leevan', 'Shavez',
    ],
    lastNames: [
      'Hield', 'Thompson', 'Miller', 'Johnson', 'Williams', 'Davis', 'Brown', 'Smith', 'Jones', 'Anderson',
      'Taylor', 'Thomas', 'Moore', 'Jackson', 'White', 'Ferguson', 'Rolle', 'Sands', 'Munroe', 'Gibson',
      'Russell', 'Butler', 'Major', 'Moss', 'Sweeting', 'Knowles', 'Forbes', 'Bethel', 'McPhee', 'Gardiner',
      'Bain', 'Cartwright', 'Darling', 'Dean', 'Rahming', 'Curry', 'Seymour', 'Strachan', 'Mackey', 'Pinder',
      'Wells', 'Newbold', 'Bastian', 'Cooper', 'Bowe', 'Lightbourne', 'Pratt', 'Stuart', 'Storr', 'Higgs',
    ],
  },

  // =============================================================================
  // WESTERN EUROPE
  // =============================================================================
  'Spanish': {
    firstNames: [
      'Juan', 'Carlos', 'Jose', 'Antonio', 'Miguel', 'Francisco', 'David', 'Daniel', 'Pablo', 'Sergio',
      'Alejandro', 'Javier', 'Fernando', 'Rafael', 'Luis', 'Jorge', 'Alvaro', 'Pedro', 'Adrian', 'Victor',
      'Rudy', 'Ricky', 'Marc', 'Pau', 'Willy', 'Juancho', 'Alberto', 'Sergio', 'Alex', 'Xavi',
      'Raul', 'Iker', 'Enrique', 'Andres', 'Diego', 'Oscar', 'Marcos', 'Mario', 'Nacho', 'Guillermo',
      'Angel', 'Manuel', 'Ricardo', 'Eduardo', 'Ignacio', 'Roberto', 'Gonzalo', 'Cesar', 'Hugo', 'Lucas',
    ],
    lastNames: [
      'Garcia', 'Rodriguez', 'Martinez', 'Lopez', 'Gonzalez', 'Hernandez', 'Perez', 'Sanchez', 'Ramirez', 'Torres',
      'Fernandez', 'Diaz', 'Moreno', 'Munoz', 'Alvarez', 'Romero', 'Alonso', 'Gutierrez', 'Navarro', 'Ruiz',
      'Gasol', 'Rubio', 'Fernandez', 'Calderon', 'Navarro', 'Reyes', 'Llull', 'Claver', 'Mirotic', 'Abrines',
      'Hernangomez', 'Garuba', 'Aldama', 'Brizuela', 'Sastre', 'Jimenez', 'Serrano', 'Molina', 'Ortega', 'Delgado',
      'Ramos', 'Iglesias', 'Medina', 'Castillo', 'Santos', 'Gil', 'Vidal', 'Guerrero', 'Blanco', 'Fuentes',
    ],
  },

  'French': {
    firstNames: [
      'Jean', 'Pierre', 'Michel', 'Nicolas', 'Philippe', 'Antoine', 'François', 'Thomas', 'Louis', 'Paul',
      'Alexandre', 'Julien', 'Vincent', 'Mathieu', 'Olivier', 'Laurent', 'Christophe', 'Sebastien', 'Guillaume', 'Stephane',
      'Tony', 'Boris', 'Evan', 'Rudy', 'Nicolas', 'Nando', 'Frank', 'Rodrigue', 'Axel', 'Theo',
      'Victor', 'Hugo', 'Timothe', 'Killian', 'Ousmane', 'Moussa', 'Isaia', 'Bilal', 'Elie', 'Yves',
      'Fabien', 'Mickael', 'Kevin', 'Alexis', 'Florent', 'Amath', 'Petr', 'Ian', 'Sylvain', 'Frederic',
    ],
    lastNames: [
      'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau',
      'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier',
      'Parker', 'Diaw', 'Gobert', 'Batum', 'Fournier', 'De Colo', 'Pietrus', 'Turiaf', 'Diarra', 'Ntilikina',
      'Poirier', 'Luwawu', 'Okobo', 'Maledon', 'Hayes', 'Sarr', 'Kabengele', 'Fall', 'Coulibaly', 'Doumbouya',
      'Wembanyama', 'Senghor', 'Traore', 'Cisse', 'Dembele', 'Konate', 'Toure', 'Keita', 'Fofana', 'Camara',
    ],
  },

  'German': {
    firstNames: [
      'Thomas', 'Michael', 'Andreas', 'Stefan', 'Christian', 'Markus', 'Daniel', 'Martin', 'Peter', 'Frank',
      'Jan', 'Jens', 'Alexander', 'Sebastian', 'Matthias', 'Patrick', 'Dennis', 'Dirk', 'Max', 'Moritz',
      'Franz', 'Dennis', 'Chris', 'Maxi', 'Isaac', 'Daniel', 'Robin', 'Johannes', 'Nick', 'Jonas',
      'Lukas', 'Paul', 'Felix', 'Leon', 'Tim', 'Niklas', 'David', 'Julian', 'Florian', 'Kevin',
      'Philipp', 'Tobias', 'Simon', 'Benjamin', 'Marcel', 'Lars', 'Sven', 'Kai', 'Nils', 'Henrik',
    ],
    lastNames: [
      'Muller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann',
      'Schafer', 'Koch', 'Bauer', 'Richter', 'Klein', 'Wolf', 'Schroder', 'Neumann', 'Schwarz', 'Zimmermann',
      'Nowitzki', 'Schroder', 'Kleber', 'Theis', 'Hartenstein', 'Wagner', 'Bonga', 'Lo', 'Obst', 'Hollatz',
      'Braun', 'Kruger', 'Hartmann', 'Lange', 'Werner', 'Krause', 'Lehmann', 'Kohler', 'Hermann', 'Konig',
      'Huber', 'Kaiser', 'Fuchs', 'Peters', 'Scholz', 'Lang', 'Weiss', 'Jung', 'Hahn', 'Vogel',
    ],
  },

  'Italian': {
    firstNames: [
      'Marco', 'Giuseppe', 'Giovanni', 'Francesco', 'Antonio', 'Alessandro', 'Andrea', 'Luca', 'Matteo', 'Lorenzo',
      'Simone', 'Paolo', 'Stefano', 'Fabio', 'Davide', 'Danilo', 'Nicolo', 'Luigi', 'Mario', 'Roberto',
      'Gianmarco', 'Nicolò', 'Achille', 'Simone', 'Gianluca', 'Amedeo', 'Daniele', 'Riccardo', 'Michele', 'Tommaso',
      'Filippo', 'Giacomo', 'Federico', 'Vincenzo', 'Salvatore', 'Angelo', 'Pietro', 'Sergio', 'Massimo', 'Claudio',
      'Bruno', 'Carlo', 'Enzo', 'Giulio', 'Alberto', 'Leonardo', 'Emanuele', 'Gabriele', 'Diego', 'Dino',
    ],
    lastNames: [
      'Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco',
      'Bruno', 'Gallo', 'Conti', 'De Luca', 'Mancini', 'Costa', 'Giordano', 'Rizzo', 'Lombardi', 'Moretti',
      'Gallinari', 'Bargnani', 'Belinelli', 'Datome', 'Gentile', 'Melli', 'Fontecchio', 'Polonara', 'Mannion', 'Procida',
      'Barbieri', 'Leone', 'Pellegrini', 'Serra', 'Caruso', 'Ferrara', 'Santoro', 'Marini', 'Marchetti', 'Rinaldi',
      'Villa', 'Farina', 'Damiani', 'Grassi', 'Sala', 'Silvestri', 'Palumbo', 'Parisi', 'Catalano', 'Vitale',
    ],
  },

  'British': {
    firstNames: [
      'James', 'John', 'William', 'David', 'Michael', 'Thomas', 'Robert', 'Richard', 'Daniel', 'Matthew',
      'Christopher', 'Andrew', 'Paul', 'Mark', 'Steven', 'George', 'Edward', 'Charles', 'Ben', 'Adam',
      'Luol', 'Joel', 'Gabe', 'Ryan', 'Myles', 'Kyle', 'OG', 'Ovie', 'Tarik', 'Devon',
      'Jack', 'Harry', 'Oliver', 'Charlie', 'Jacob', 'Alfie', 'Oscar', 'Henry', 'Leo', 'Archie',
      'Max', 'Joshua', 'Ethan', 'Joseph', 'Samuel', 'Lewis', 'Nathan', 'Connor', 'Callum', 'Jamie',
    ],
    lastNames: [
      'Smith', 'Jones', 'Williams', 'Brown', 'Taylor', 'Davies', 'Wilson', 'Evans', 'Thomas', 'Johnson',
      'Roberts', 'Walker', 'Wright', 'Robinson', 'Thompson', 'White', 'Hughes', 'Edwards', 'Green', 'Hall',
      'Deng', 'Freeland', 'Sherwin', 'Sherwood', 'Gordon', 'Sherwood', 'Sherwin', 'Van', 'Sherwood', 'Sherwin',
      'Clark', 'Lewis', 'King', 'Baker', 'Harris', 'Turner', 'Parker', 'Marshall', 'Collins', 'Bell',
      'Morris', 'Bailey', 'Murphy', 'Cooper', 'Morgan', 'Reed', 'Richardson', 'Howard', 'Phillips', 'Watson',
    ],
  },

  // =============================================================================
  // EASTERN EUROPE & BALKANS
  // =============================================================================
  'Serbian': {
    firstNames: [
      'Nikola', 'Stefan', 'Marko', 'Milos', 'Nemanja', 'Vladimir', 'Dejan', 'Aleksandar', 'Predrag', 'Vlade',
      'Boban', 'Bogdan', 'Vasilije', 'Ognjen', 'Filip', 'Luka', 'Dusan', 'Slobodan', 'Zoran', 'Dragan',
      'Milan', 'Darko', 'Sasha', 'Peja', 'Vlade', 'Zarko', 'Nenad', 'Miroslav', 'Branislav', 'Goran',
      'Dragan', 'Rasko', 'Borisa', 'Djordje', 'Ilija', 'Jovan', 'Novak', 'Petar', 'Radoslav', 'Sasa',
      'Strahinja', 'Teodor', 'Viktor', 'Vuk', 'Zdravko', 'Zeljko', 'Zivorad', 'Zvonimir', 'Andrija', 'Boris',
    ],
    lastNames: [
      'Jokic', 'Bogdanovic', 'Marjanovic', 'Teodosic', 'Bjelica', 'Stojakovic', 'Divac', 'Radmanovic', 'Jaric', 'Krstic',
      'Jovic', 'Milicic', 'Obradovic', 'Danilovic', 'Paspalj', 'Djordjevic', 'Savic', 'Petrovic', 'Nikolic', 'Ilic',
      'Mitrovic', 'Pavlovic', 'Markovic', 'Tomic', 'Kostic', 'Stefanovic', 'Simonovic', 'Micic', 'Davidovac', 'Avramovic',
      'Popovic', 'Radovic', 'Stojanovic', 'Lazic', 'Antic', 'Milosevic', 'Novakovic', 'Vukovic', 'Ristic', 'Stankovic',
      'Lukic', 'Gajic', 'Vasic', 'Pantic', 'Zivkovic', 'Aleksic', 'Mirkovic', 'Babic', 'Rajic', 'Kovacevic',
    ],
  },

  'Croatian': {
    firstNames: [
      'Luka', 'Dario', 'Bojan', 'Drazen', 'Toni', 'Mario', 'Zoran', 'Ivica', 'Ante', 'Goran',
      'Marko', 'Ivan', 'Josip', 'Matej', 'Filip', 'Nikola', 'Kristijan', 'Damir', 'Bruno', 'Marin',
      'Tomislav', 'Vedran', 'Darko', 'Stipe', 'Hrvoje', 'Domagoj', 'Kresimir', 'Petar', 'Sime', 'Zvonimir',
      'Antonio', 'Branimir', 'Danijel', 'Emanuel', 'Franjo', 'Gordan', 'Jadranko', 'Krunoslav', 'Lovro', 'Miljenko',
      'Nenad', 'Oliver', 'Patrik', 'Renato', 'Sinisa', 'Tihomir', 'Vjekoslav', 'Zdravko', 'Zlatko', 'Boris',
    ],
    lastNames: [
      'Doncic', 'Saric', 'Bogdanovic', 'Petrovic', 'Kukoc', 'Radja', 'Tabak', 'Vrankovic', 'Andric', 'Zuban',
      'Horvat', 'Kovac', 'Babic', 'Maric', 'Juric', 'Novak', 'Kovacic', 'Knezevic', 'Vukovic', 'Blazevic',
      'Perisic', 'Rakitic', 'Modric', 'Mandzukic', 'Kramaric', 'Brozovic', 'Rebic', 'Lovren', 'Vida', 'Corluka',
      'Matic', 'Tomic', 'Pavic', 'Simic', 'Radic', 'Grbic', 'Zupan', 'Lucic', 'Soljic', 'Bulic',
      'Hezonja', 'Zubac', 'Bender', 'Samardzic', 'Smits', 'Stipanovic', 'Markovic', 'Bilic', 'Perkovic', 'Mandic',
    ],
  },

  'Greek': {
    firstNames: [
      'Giannis', 'Kostas', 'Thanasis', 'Dimitris', 'Nikos', 'Georgios', 'Vassilis', 'Panagiotis', 'Konstantinos', 'Michalis',
      'Alexandros', 'Ioannis', 'Christos', 'Evangelos', 'Stavros', 'Anastasios', 'Theodoros', 'Spyros', 'Athanasios', 'Nikolaos',
      'Andreas', 'Petros', 'Sotiris', 'Leonidas', 'Kosmas', 'Antonios', 'Vasileios', 'Ilias', 'Apostolos', 'Dionysios',
      'Emmanouil', 'Fotios', 'Grigorios', 'Charalampos', 'Iraklis', 'Jason', 'Kyriakos', 'Lambros', 'Marios', 'Pavlos',
      'Raphael', 'Stamatis', 'Themis', 'Vangelis', 'Xenofon', 'Yiannis', 'Zafeiris', 'Achilleas', 'Baltazar', 'Chrysostomos',
    ],
    lastNames: [
      'Antetokounmpo', 'Diamantidis', 'Spanoulis', 'Papanikolaou', 'Bourousis', 'Papaloukas', 'Fotsis', 'Zisis', 'Schortsanitis', 'Printezis',
      'Papadopoulos', 'Georgiou', 'Dimitriou', 'Konstantinou', 'Nikolaou', 'Vasiliou', 'Ioannou', 'Christodoulou', 'Alexandrou', 'Antoniou',
      'Athanasiou', 'Economou', 'Giannopoulos', 'Karagiannis', 'Makris', 'Panagiotou', 'Stavrou', 'Theodorou', 'Vasilakis', 'Zachariadis',
      'Koufos', 'Calathes', 'Sloukas', 'Papagiannis', 'Mitoglou', 'Kalaitzakis', 'Dorsey', 'Larentzakis', 'Agravanis', 'Bogris',
      'Mantzaris', 'Gkikas', 'Mavroeidis', 'Papapetrou', 'Sakota', 'Tsalmpouris', 'Charalampidis', 'Lountzis', 'Papathanasiou', 'Chatzigeorgiou',
    ],
  },

  'Turkish': {
    firstNames: [
      'Enes', 'Hedo', 'Mehmet', 'Ersan', 'Semih', 'Omer', 'Cedi', 'Furkan', 'Alperen', 'Ibrahim',
      'Ahmet', 'Mustafa', 'Ali', 'Emre', 'Burak', 'Kerem', 'Yusuf', 'Murat', 'Ozan', 'Can',
      'Serkan', 'Oguz', 'Onur', 'Baris', 'Cenk', 'Deniz', 'Efe', 'Fatih', 'Gokhan', 'Hakan',
      'Ismail', 'Kaan', 'Levent', 'Melih', 'Necati', 'Orhan', 'Polat', 'Recep', 'Selim', 'Tamer',
      'Umut', 'Volkan', 'Yasin', 'Zafer', 'Adem', 'Berkay', 'Caner', 'Doruk', 'Emir', 'Ferhat',
    ],
    lastNames: [
      'Kanter', 'Turkoglu', 'Okur', 'Ilyasova', 'Erden', 'Asik', 'Osman', 'Korkmaz', 'Sengun', 'Yilmaz',
      'Ozturk', 'Aydin', 'Celik', 'Demir', 'Sahin', 'Arslan', 'Kaya', 'Erdogan', 'Polat', 'Ozer',
      'Tekin', 'Gul', 'Dogan', 'Koc', 'Aksoy', 'Yildiz', 'Ozkan', 'Kurt', 'Kilic', 'Tas',
      'Keskin', 'Coskun', 'Cetin', 'Karaca', 'Bayrak', 'Bulut', 'Tuncer', 'Toprak', 'Kaplan', 'Duman',
      'Gonul', 'Soylu', 'Acar', 'Unal', 'Atasoy', 'Basaran', 'Cakar', 'Durmaz', 'Ekinci', 'Guler',
    ],
  },

  'Lithuanian': {
    firstNames: [
      'Arvydas', 'Zydrunas', 'Sarunas', 'Domantas', 'Jonas', 'Donatas', 'Martynas', 'Mindaugas', 'Linas', 'Tomas',
      'Mantas', 'Paulius', 'Robertas', 'Deividas', 'Eimantas', 'Giedrius', 'Karolis', 'Lukas', 'Marius', 'Rokas',
      'Arturas', 'Vytautas', 'Darius', 'Edgaras', 'Ignas', 'Justas', 'Kristupas', 'Laurynas', 'Nerijus', 'Osvaldas',
      'Povilas', 'Rimas', 'Simas', 'Tadas', 'Ugnius', 'Vilius', 'Zygimantas', 'Andrius', 'Benas', 'Chodas',
      'Daumantas', 'Emilis', 'Faustas', 'Gediminas', 'Henrikas', 'Irmantas', 'Julius', 'Kestutis', 'Leonas', 'Motiejus',
    ],
    lastNames: [
      'Sabonis', 'Ilgauskas', 'Jasikevicius', 'Valanciunas', 'Motiejunas', 'Pocius', 'Javtokas', 'Kleiza', 'Siskauskas', 'Kavaliauskas',
      'Kazlauskas', 'Petrauskas', 'Jonaitis', 'Stankevičius', 'Balciunas', 'Jankauskas', 'Urbonas', 'Butkus', 'Zukauskas', 'Maciulis',
      'Jankūnas', 'Kuzminskas', 'Lekavicius', 'Giedraitis', 'Brazdeikis', 'Butkevicius', 'Dimša', 'Echodas', 'Gecevičius', 'Kulboka',
      'Bendzius', 'Grigonis', 'Sirvydis', 'Sedekerskis', 'Ulanovas', 'Velička', 'Žemaitis', 'Tubelis', 'Kriisa', 'Paukste',
      'Rutkauskas', 'Šeštokas', 'Žalgiris', 'Butkevičius', 'Grigas', 'Kalnietis', 'Landesberg', 'Normantas', 'Sinica', 'Vasiliauskas',
    ],
  },

  // =============================================================================
  // OCEANIA
  // =============================================================================
  'Australian': {
    firstNames: [
      'Ben', 'Andrew', 'Patty', 'Joe', 'Matthew', 'Josh', 'Dante', 'Jock', 'Dyson', 'Jack',
      'Ryan', 'Luc', 'Nathan', 'Chris', 'David', 'Cameron', 'Brad', 'Daniel', 'Sam', 'Luke',
      'James', 'Michael', 'William', 'Thomas', 'Alexander', 'Ethan', 'Joshua', 'Noah', 'Oliver', 'Max',
      'Cooper', 'Lachlan', 'Harrison', 'Jayden', 'Connor', 'Riley', 'Jackson', 'Hunter', 'Kai', 'Beau',
      'Xavier', 'Zac', 'Mitchell', 'Angus', 'Blake', 'Caleb', 'Declan', 'Flynn', 'Hamish', 'Jake',
    ],
    lastNames: [
      'Simmons', 'Bogut', 'Mills', 'Ingles', 'Dellavedova', 'Gaze', 'Longley', 'Exum', 'Landale', 'Green',
      'Baynes', 'Broekhoff', 'Daniels', 'Kay', 'Creek', 'Sobey', 'Goulding', 'Lisch', 'Maric', 'Nielsen',
      'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Wilson', 'Taylor', 'Anderson', 'Thomas', 'White',
      'Martin', 'Thompson', 'Robinson', 'Clark', 'Lewis', 'Walker', 'Hall', 'Young', 'King', 'Wright',
      'Murphy', 'Kelly', 'Ryan', 'Roberts', 'Campbell', 'Edwards', 'Collins', 'Stewart', 'Morris', 'Murray',
    ],
  },

  // =============================================================================
  // AFRICA
  // =============================================================================
  'Nigerian': {
    firstNames: [
      'Hakeem', 'Giannis', 'Al-Farouq', 'Festus', 'Josh', 'Chimezie', 'Precious', 'Udoka', 'Ike', 'Jordan',
      'Ekpe', 'Michael', 'Olumide', 'Alade', 'Amar', 'Uche', 'Emeka', 'Chukwudi', 'Obinna', 'Nnamdi',
      'Adebayo', 'Chibueze', 'Damilola', 'Efe', 'Femi', 'Gbenga', 'Ifeoluwa', 'Jide', 'Kelechi', 'Lotanna',
      'Musa', 'Ngozi', 'Oluwaseun', 'Prosper', 'Qudus', 'Rotimi', 'Segun', 'Tunde', 'Ugochukwu', 'Victor',
      'Wale', 'Yinka', 'Zion', 'Ayomide', 'Babatunde', 'Chinonso', 'Dubem', 'Ekene', 'Fisayo', 'Godwin',
    ],
    lastNames: [
      'Olajuwon', 'Aminu', 'Ezeli', 'Okafor', 'Metu', 'Achiuwa', 'Azubuike', 'Nwora', 'Okpala', 'Udoh',
      'Okonkwo', 'Ogwumike', 'Okeke', 'Nwankwo', 'Eze', 'Adeyemi', 'Ajayi', 'Balogun', 'Chukwuemeka', 'Dike',
      'Ezeigbo', 'Fashola', 'Gbadebo', 'Ibeh', 'Ihejirika', 'Iwu', 'Jakande', 'Kanu', 'Lawal', 'Maduka',
      'Nduka', 'Obiora', 'Onwueme', 'Peterside', 'Quadri', 'Sule', 'Tinubu', 'Uduaghan', 'Umeh', 'Uzoma',
      'Vaughan', 'Yakubu', 'Zukoma', 'Akinyemi', 'Bamidele', 'Coker', 'Daramola', 'Edozie', 'Fadipe', 'Obi',
    ],
  },

  'Cameroonian': {
    firstNames: [
      'Joel', 'Pascal', 'Luc', 'Bruno', 'Ruben', 'Christian', 'Pierre', 'Jean', 'Paul', 'Michel',
      'Serge', 'Stephane', 'Franck', 'Eric', 'Samuel', 'Emmanuel', 'Patrick', 'Didier', 'Fabrice', 'Herve',
      'Andre', 'Charles', 'Daniel', 'Felix', 'Gaston', 'Henri', 'Jacques', 'Louis', 'Marc', 'Nicolas',
      'Olivier', 'Philippe', 'Robert', 'Simon', 'Thomas', 'Victor', 'William', 'Xavier', 'Yves', 'Zacharie',
      'Alain', 'Bernard', 'Claude', 'Denis', 'Eugene', 'Francois', 'Gerard', 'Jules', 'Kevin', 'Laurent',
    ],
    lastNames: [
      'Embiid', 'Siakam', 'Mbah a Moute', 'Biyombo', 'Nogueira', 'Eboua', 'Song', 'Eto\'o', 'Milla', 'Foe',
      'Kameni', 'Wome', 'Tchato', 'Nkoulou', 'Matip', 'Bassogog', 'Ekambi', 'Moukandjo', 'Choupo-Moting', 'Onana',
      'Aboubakar', 'Bahoken', 'Njie', 'Salli', 'Zoua', 'Djoum', 'Kunde', 'Ngadeu', 'Toko Ekambi', 'Zambo',
      'Mbarga', 'Ntoungou', 'Eyenga', 'Fokou', 'Gervais', 'Kamga', 'Lontchi', 'Makoun', 'Ndioro', 'Olinga',
      'Pokam', 'Teikeu', 'Yombi', 'Ateba', 'Banga', 'Etoundi', 'Fotso', 'Mbia', 'Ndip', 'Tchakounte',
    ],
  },

  'Senegalese': {
    firstNames: [
      'Gorgui', 'Tacko', 'Moussa', 'Cheikh', 'Mamadou', 'Abdoulaye', 'Ibrahima', 'Oumar', 'Modou', 'Pape',
      'Amadou', 'Aliou', 'Babacar', 'Cheikhou', 'Demba', 'El Hadji', 'Famara', 'Habib', 'Idrissa', 'Kalidou',
      'Lamine', 'Mbaye', 'Ndongo', 'Ousseynou', 'Pape', 'Sadio', 'Salif', 'Sidy', 'Samba', 'Serigne',
      'Balla', 'Bara', 'Bouba', 'Cheikh', 'Daouda', 'Diagne', 'Fallou', 'Gana', 'Henri', 'Ismaila',
      'Issa', 'Malick', 'Matar', 'Ndiaye', 'Papy', 'Racine', 'Seydou', 'Thierno', 'Youssou', 'Zargo',
    ],
    lastNames: [
      'Dieng', 'Fall', 'Ndiaye', 'Samb', 'Diop', 'Seck', 'Mbaye', 'Cissé', 'Faye', 'Sy',
      'Diallo', 'Sow', 'Ba', 'Gueye', 'Sarr', 'Thiam', 'Wade', 'Toure', 'Kane', 'Diouf',
      'Konate', 'Mane', 'Niang', 'Sane', 'Badji', 'Camara', 'Dabo', 'Mendy', 'Ndoye', 'Sagna',
      'Balde', 'Coly', 'Diatta', 'Keita', 'Lam', 'Ngom', 'Pouye', 'Sabaly', 'Tavares', 'Wague',
      'Boye', 'Diedhiou', 'Drame', 'Gomis', 'Kouyate', 'Mbodj', 'Niasse', 'Sakho', 'Sene', 'Traore',
    ],
  },

  'South Sudanese': {
    firstNames: [
      'Luol', 'Manute', 'Thon', 'Wenyen', 'Bol', 'Deng', 'Dut', 'Majok', 'Kuany', 'Ajak',
      'Akol', 'Atem', 'Aweil', 'Bul', 'Chol', 'Dak', 'Duop', 'Garang', 'Jok', 'Kuol',
      'Lat', 'Lual', 'Mabior', 'Marial', 'Mayom', 'Ngor', 'Nhial', 'Panther', 'Ring', 'Santino',
      'Sunday', 'Thiik', 'Tong', 'Wek', 'Wol', 'Yak', 'Akech', 'Awer', 'Biar', 'Choul',
      'Dau', 'Gai', 'Guor', 'Jal', 'Ker', 'Kur', 'Lam', 'Mading', 'Makuach', 'Manyok',
    ],
    lastNames: [
      'Deng', 'Bol', 'Maker', 'Gabriel', 'Adel', 'Mawien', 'Maluach', 'Kuany', 'Ajou', 'Akok',
      'Aguer', 'Akoon', 'Alier', 'Atem', 'Aweil', 'Biar', 'Chol', 'Dak', 'Duop', 'Garang',
      'Jok', 'Kur', 'Lam', 'Lual', 'Mabior', 'Machar', 'Majok', 'Manyang', 'Marial', 'Mayom',
      'Ngor', 'Nhial', 'Ring', 'Wek', 'Wol', 'Akech', 'Awer', 'Bul', 'Choul', 'Dau',
      'Gai', 'Guor', 'Jal', 'Ker', 'Mading', 'Makuach', 'Manyok', 'Thiik', 'Tong', 'Yak',
    ],
  },

  // =============================================================================
  // ASIA
  // =============================================================================
  'Chinese': {
    firstNames: [
      'Yao', 'Yi', 'Zhou', 'Wang', 'Sun', 'Guo', 'Ding', 'Hu', 'Liu', 'Zhao',
      'Wei', 'Zhu', 'Chen', 'Yang', 'Lin', 'Zhang', 'Li', 'Xu', 'Ma', 'Luo',
      'Hao', 'Jun', 'Jian', 'Ming', 'Feng', 'Lei', 'Peng', 'Bo', 'Kai', 'Cheng',
      'Tao', 'Qiang', 'Dong', 'Xin', 'Fei', 'Wen', 'Long', 'Sheng', 'Rui', 'Zhi',
      'Yuan', 'Gang', 'Ping', 'Xiang', 'Hong', 'Yong', 'Bin', 'Jie', 'Nan', 'Xiong',
    ],
    lastNames: [
      'Ming', 'Jianlian', 'Qi', 'Zhizhi', 'Yue', 'Ailun', 'Yanhao', 'Wang', 'Liu', 'Zhang',
      'Li', 'Chen', 'Yang', 'Zhao', 'Huang', 'Zhou', 'Wu', 'Xu', 'Sun', 'Ma',
      'Zhu', 'Hu', 'Guo', 'Lin', 'He', 'Gao', 'Liang', 'Zheng', 'Luo', 'Song',
      'Xie', 'Tang', 'Han', 'Feng', 'Cao', 'Deng', 'Peng', 'Xiao', 'Ding', 'Yu',
      'Jiang', 'Shen', 'Zeng', 'Wei', 'Lu', 'Ye', 'Pan', 'Du', 'Fang', 'Su',
    ],
  },

  'Japanese': {
    firstNames: [
      'Yuta', 'Rui', 'Kei', 'Yuki', 'Takumi', 'Kenji', 'Hiroshi', 'Daiki', 'Shota', 'Naoki',
      'Ryota', 'Kosuke', 'Makoto', 'Kazuki', 'Taro', 'Shin', 'Haruki', 'Kaito', 'Ren', 'Sho',
      'Hayato', 'Sota', 'Kentaro', 'Masashi', 'Yusuke', 'Takuya', 'Kenta', 'Akira', 'Shunsuke', 'Daisuke',
      'Ryuichi', 'Kohei', 'Tetsuya', 'Naoya', 'Shinji', 'Yuji', 'Tomoya', 'Tsubasa', 'Kenichi', 'Hideki',
      'Junichi', 'Satoshi', 'Yoshihiro', 'Masato', 'Nobuhiro', 'Ryohei', 'Shogo', 'Takashi', 'Yasuhiro', 'Kazuya',
    ],
    lastNames: [
      'Watanabe', 'Hachimura', 'Tanaka', 'Yamamoto', 'Suzuki', 'Sato', 'Takahashi', 'Ito', 'Nakamura', 'Kobayashi',
      'Kato', 'Yoshida', 'Yamada', 'Sasaki', 'Yamaguchi', 'Matsumoto', 'Inoue', 'Kimura', 'Hayashi', 'Shimizu',
      'Saito', 'Mori', 'Hashimoto', 'Ogawa', 'Fujita', 'Okada', 'Goto', 'Hasegawa', 'Murakami', 'Kondo',
      'Ishikawa', 'Abe', 'Ikeda', 'Yamazaki', 'Maeda', 'Fujii', 'Okamoto', 'Matsuda', 'Nakagawa', 'Nakano',
      'Harada', 'Ono', 'Tamura', 'Takeuchi', 'Kaneko', 'Wada', 'Ishida', 'Ueda', 'Morita', 'Hara',
    ],
  },

  'Korean': {
    firstNames: [
      'Seung', 'Min', 'Jin', 'Hyun', 'Sung', 'Jun', 'Young', 'Dong', 'Jae', 'Woo',
      'Hee', 'Ho', 'Kyung', 'Tae', 'Sang', 'Myung', 'Chang', 'Ki', 'Jung', 'Soo',
      'Dae', 'Han', 'Byung', 'Sun', 'Yong', 'Il', 'Won', 'Joong', 'Moon', 'Kwang',
      'Chul', 'Kyu', 'Bum', 'Gyu', 'Jong', 'Man', 'Nam', 'Sam', 'Si', 'Eun',
      'Joon', 'Hyuk', 'Hwan', 'Jin', 'Wook', 'Yeol', 'Beom', 'Deok', 'Geun', 'Hak',
    ],
    lastNames: [
      'Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Cho', 'Yoon', 'Jang', 'Lim',
      'Han', 'Oh', 'Seo', 'Shin', 'Kwon', 'Hwang', 'Ahn', 'Song', 'Yoo', 'Hong',
      'Moon', 'Yang', 'Bae', 'Ha', 'Noh', 'Son', 'Nam', 'Ryu', 'Baek', 'Jeon',
      'Heo', 'Goh', 'Yun', 'Won', 'Chung', 'Ku', 'Min', 'Cheon', 'Ji', 'Byun',
      'Sim', 'Uhm', 'Ye', 'Bang', 'Gil', 'Seong', 'Tak', 'Eom', 'Im', 'Ko',
    ],
  },

  'Filipino': {
    firstNames: [
      'Jordan', 'Calvin', 'Jayson', 'Kai', 'Jalen', 'Kiefer', 'Thirdy', 'Dwight', 'Bobby Ray', 'Scottie',
      'Juan', 'Miguel', 'Jose', 'Marco', 'Francis', 'Marc', 'Jun Mar', 'Jeff', 'Ranidel', 'Kelly',
      'Arwind', 'Mark', 'Japeth', 'James', 'Terrence', 'Troy', 'Chris', 'LA', 'Stanley', 'Alex',
      'Paolo', 'Carlo', 'Gabriel', 'Rafael', 'Antonio', 'Roberto', 'Eduardo', 'Fernando', 'Luis', 'Diego',
      'Andres', 'Enrique', 'Javier', 'Ricardo', 'Adrian', 'Manuel', 'Victor', 'Rodrigo', 'Sergio', 'Daniel',
    ],
    lastNames: [
      'Clarkson', 'Abueva', 'Castro', 'Sotto', 'Green', 'Ravena', 'Ramos', 'Parks', 'Thompson', 'Romeo',
      'Santos', 'Reyes', 'Cruz', 'Bautista', 'Del Rosario', 'Garcia', 'Gonzales', 'Hernandez', 'Lopez', 'Martinez',
      'Fernandez', 'De La Cruz', 'Torres', 'Flores', 'Dela Cruz', 'Mendoza', 'Rivera', 'Soriano', 'Villanueva', 'Castillo',
      'Aguilar', 'Aquino', 'Corpuz', 'Delos Santos', 'Estacio', 'Fajardo', 'Gorospe', 'Ignacio', 'Jaramillo', 'Lozada',
      'Malabanan', 'Navarro', 'Ocampo', 'Perez', 'Quiambao', 'Rosales', 'Salvador', 'Tolentino', 'Uy', 'Velasco',
    ],
  },

  'Taiwanese': {
    firstNames: [
      'Jeremy', 'Cheng', 'Wei', 'Chih', 'Chia', 'Hao', 'Yu', 'Chen', 'Ming', 'Jun',
      'Sheng', 'Hong', 'Yi', 'Jian', 'Kai', 'Zhi', 'Ting', 'Feng', 'Lei', 'Bo',
      'Peng', 'Tao', 'Gang', 'Rui', 'Long', 'Xiang', 'Wen', 'Yang', 'Fei', 'Cheng',
      'Qiang', 'Dong', 'Xin', 'Yuan', 'Ping', 'Yong', 'Bin', 'Jie', 'Nan', 'Kuan',
      'Ta', 'Tsung', 'Hsuan', 'Chun', 'Te', 'Han', 'Shih', 'Sung', 'Po', 'Li',
    ],
    lastNames: [
      'Lin', 'Chen', 'Huang', 'Chang', 'Wu', 'Wang', 'Lee', 'Tsai', 'Yang', 'Liu',
      'Hsu', 'Cheng', 'Lai', 'Hsieh', 'Kuo', 'Sung', 'Lu', 'Yeh', 'Su', 'Tseng',
      'Chou', 'Liao', 'Lo', 'Chiang', 'Fang', 'Shih', 'Teng', 'Fan', 'Chung', 'Chiou',
      'Hu', 'Tang', 'Tsou', 'Wei', 'Yen', 'Chao', 'Kung', 'Pan', 'Tung', 'Ho',
      'Ma', 'Jen', 'Peng', 'Yu', 'Tien', 'Kao', 'Pai', 'Tu', 'Shao', 'Han',
    ],
  },
};

/**
 * Middle initials for fallback name generation when duplicates occur
 */
export const MIDDLE_INITIALS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K',
  'L', 'M', 'N', 'P', 'R', 'S', 'T', 'W', 'X', 'Z',
];
