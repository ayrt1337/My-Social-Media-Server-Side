# Em desenvolvimento

Para a finalização deste projeto ainda é necessário a implementação de uma interface responsiva no Client-Side

# Considerações iniciais

Este projeto se consiste na criação de uma rede social, onde é possível interagir por meio de postagens e comentários, além também de outras funcionalidades

Para a construção do Server-Side foi utilizado o framework Express juntamente com o banco de dados não relacional MongoDB

# Como iniciar a aplicação

## Instale as dependências do projeto

Abra o terminal e insira "npm install"

## Configure o banco de dados MongoDB

É possível realizar o download por aqui: https://www.mongodb.com/try/download/community-kubernetes-operator

Após feito o download e instalação é preciso realizar a criação do banco de dados "mySocialMedia", mais detalhes sobre como fazer isso pode ser encontrado aqui: https://medium.com/@ishvini2000/mongodb-compass-create-database-and-insert-document-c4f92c29e6a

Lembre-se! É necessário apenas a criação do banco de dados, as coleções (tabelas) serão criadas automaticamente pelo código mediante utilização

## Inicie o back-end

Ainda no terminal insira "nodemon app.js" ou "node app.js"

Pronto! Agora o back-end da aplicação está funcionando, porém para a utilização completa do sistema também é necessário a inicialização do Client-Side, para isso acesse este repositório: https://github.com/ayrt1337/My-Social-Media-Client-Side
