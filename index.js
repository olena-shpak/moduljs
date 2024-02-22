function getGql(url) {
    function gql(query, variables = {}) {
        return fetch(url, 
            {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...(store.getState().auth.token ? { Authorization: `Bearer ${store.getState().auth.token}` } : null),
            },
            body: JSON.stringify({ query, variables }),
        })
        .then((res) => res.json())
        .then((r) => {
            if (r.data) {
                return r.data
            }
            throw new Error(r.errors[0].message)
        })
        .catch((error) => console.log(error));
    }
    return gql;
}






const gql = getGql("http://shop-roles.node.ed.asmer.org.ua/graphql")

function createStore(reducer) {
    let state = reducer(undefined, {}) //стартовая инициализация состояния, запуск редьюсера со state === undefined
    let cbs = []                     //массив подписчиков

    const getState = () => state            //функция, возвращающая переменную из замыкания
    const subscribe = cb => (cbs.push(cb),   //запоминаем подписчиков в массиве
        () => cbs = cbs.filter(c => c !== cb)) //возвращаем функцию unsubscribe, которая удаляет подписчика из списка

    const dispatch = action => {
        if (typeof action === 'function') { //если action - не объект, а функция
            return action(dispatch, getState) //запускаем эту функцию и даем ей dispatch и getState для работы
        }
        const newState = reducer(state, action) //пробуем запустить редьюсер
        if (newState !== state) { //проверяем, смог ли редьюсер обработать action
            state = newState //если смог, то обновляем state 
            for (let cb of cbs) cb(state) //и запускаем подписчиков
        }
    }

    return {
        getState, //добавление функции getState в результирующий объект
        dispatch,
        subscribe //добавление subscribe в объект
    }
}

function localStoredReducer(originalReducer, localStorageKey) {
    function wrapper(state, action) {
        if (state === undefined) {
            try {
                return JSON.parse(localStorage[localStorageKey])
            } catch (error) {
                console.log(console.error())
            }

        }

        const newState = originalReducer(state, action)
        localStorage[localStorageKey] = JSON.stringify(newState)

        return newState
    }

    return wrapper
}

function combineReducers(reducers) {
    function totalReducer(state = {}, action) {
        const newTotalState = {}
        for (const [reducerName, childReducer] of Object.entries(reducers)) {
            const newSubState = childReducer(state[reducerName], action)
            if (newSubState !== state[reducerName]) {
                newTotalState[reducerName] = newSubState
            }
        }
        if (Object.values(newTotalState).length) {
            return { ...state, ...newTotalState }
        }
        return state
    }

    return totalReducer
}

function cartReducer(state = {}, action) {
    if (action.type === 'CART_ADD') {
        return {
            ...state,
            [action.good._id]: {
                good: action.good,
                count: state[action.good._id] ? state[action.good._id].count + action.count : action.count
            }
        };
    } else if (action.type === 'CART_SUB' && state[action.good._id]) {
        const newCountSub = state[action.good._id].count - action.count;
        if (newCountSub <= 0) {
            const newState = { ...state };
            delete newState[action.good._id];
            return newState;
        }
        return {
            ...state,
            [action.good._id]: {
                ...state[action.good._id],
                count: newCountSub
            }
        };
    } else if (action.type === 'CART_DEL') {
        const newStateDel = { ...state };
        delete newStateDel[action.good._id];
        return newStateDel;
    } else if (action.type === 'CART_SET' && action.count <= 0) {
        const newStateSet = { ...state };
        delete newStateSet[action.good._id];
        return newStateSet;
    } else if (action.type === 'CART_CLEAR') {
        return {};
    }
    return state;
}

// Типи екшенів
const actionCartAdd = (good, count = 1) => ({ type: 'CART_ADD', count, good });
const actionCartSub = (good, count = 1) => ({ type: 'CART_SUB', count, good });
const actionCartDel = (good) => ({ type: 'CART_DEL', good });
const actionCartSet = (good, count = 1) => ({ type: 'CART_SET', count, good });
const actionCartClear = () => ({ type: 'CART_CLEAR' });

const jwtDecode = token => {

    try{
      return  JSON.parse(atob (token.split('.')[1]) )
    } catch {

    }
}

const authReducer = (state = {}, action) => {
    
    const { type, token } = action
    if (type === 'AUTH_LOGIN') {

        try {
            const payload = jwtDecode(token);
            if (payload) {
                return {
                    token,
                    payload
                };
            }

        } catch (error) {
            console.log('opacha', error);
            return {}
        }
    } else if (type === 'AUTH_LOGOUT') {

        return {};
    } else {
        return state;
    }
};


const actionAuthLogin = (token) => ({ type: 'AUTH_LOGIN', token });
const actionAuthLogout = () => ({ type: 'AUTH_LOGOUT' });

const reducers = {
    promise: promiseReducer, //допилить много имен для многих промисо
    auth: localStoredReducer(authReducer, "auth"),
    cart: localStoredReducer(cartReducer, "cart")
}

const totalReducer = combineReducers(reducers)

function promiseReducer(state = {}, action) {
    const { namePromise, type, status, payload, error } = action
    if (type === 'PROMISE') {
        return {
            ...state,
            [namePromise]: {
                type,
                status,
                payload,
                error
            }
        }

    }
    return state
}

const actionPending = namePromise => ({ namePromise, type: 'PROMISE', status: 'PENDING' })
const actionFulfilled = (namePromise, payload) => ({ namePromise, type: 'PROMISE', status: 'FULFILLED', payload })
const actionRejected = (namePromise, error) => ({ namePromise, type: 'PROMISE', status: 'REJECTED', error })

const actionPromise = (namePromise, promise) => async dispatch => {
    dispatch(actionPending(namePromise))

    try {
        const payload = await promise
        dispatch(actionFulfilled(namePromise, payload))
        return payload
    } catch (error) {
        dispatch(actionRejected(namePromise, error))
    }
}



const store = createStore(combineReducers(reducers)) //не забудьте combineReducers если он у вас уже есть
store.subscribe(() => console.log(store.getState()))

function updateCartItemCount() {
    const cartIcon = document.querySelector('#cartIcon');
    const cartState = store.getState().cart;
    if (cartState && cartState.cart) {
        const cartItemCount = cartState.cart.reduce((total, item) => total + item.count, 0);
        cartIcon.textContent = cartItemCount;
    }
}

store.subscribe(updateCartItemCount);

updateCartItemCount();


const drawCategory = () => {
    const [, route] = location.hash.split('/')
    if (route !== 'category') return

    const { status, payload, error } = store.getState().promise.categoryById || {}
    if (status === 'PENDING') {
        main.innerHTML = `<img src='https://cdn.dribbble.com/users/63485/screenshots/1309731/infinite-gif-preloader.gif' />`
    }
    if (status === 'FULFILLED') {
        const { name, goods } = payload.CategoryFindOne
        main.innerHTML = `<h1>${name}</h1>`
        for (const { _id, name, price, images } of goods) {
            main.innerHTML += `<div>
            <a href = "#/good/${_id}">${name}</a>
            <div><img style= "max-width:25vw" src="http://shop-roles.node.ed.asmer.org.ua/${images && images[0] && images[0].url}"></div>
            <p>Ціна: ${price} грн.</p>
            <button id="add-to-cart-button"> Додати в кошик </button>
            </div>`
        }

    }
}

store.subscribe(drawCategory)


const drawCart = (cartItems) => {
    const [, route] = location.hash.split('/');
    if (route !== 'cart') return;

    const { cart } = store.getState().cart;
    const cartContainer = document.getElementById('cartIcon');

    cartContainer.innerHTML = '';

    cart.forEach(item => {
        const { name, price, count } = item;
        const itemElement = document.createElement('div');
        itemElement.innerHTML = `
            <h3>${name}</h3>
            <div><img style= "max-width:25vw" src="http://shop-roles.node.ed.asmer.org.ua/${images && images[0] && images[0].url}"></div>
            <p>Ціна: ${price} грн.</p>
            <p>Кількість: ${count}</p>
            <button class="remove-from-cart" data-id="${item._id}">Видалити</button>
        `;
        cartContainer.appendChild(itemElement);
    });

    const removeButtons = document.querySelectorAll('.remove-from-cart');
    removeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const itemId = button.dataset.id;
            store.dispatch(actionCartDel(itemId));
        });
    });

    // Оновлюємо кількість товарів у відображенні кошика
    updateCartItemCount();
};




/// Створення форми реєстрації
const drawRegisterForm = () => {
    const formRegister = document.createElement('form');
    formRegister.classList.add('hidden')
    const loginInput = document.createElement('input');
    loginInput.type = 'text';
    loginInput.style.width = '150px'
    loginInput.placeholder = 'Enter your login';

    const passwordInput = document.createElement('input');
    passwordInput.type = 'password';
    passwordInput.style.width = '150px'
    passwordInput.placeholder = 'Enter your password';
    

    const button = document.createElement('button');
    button.innerText = 'Зареєструватися';
    button.setAttribute('disabled', true);

    formRegister.appendChild(loginInput);
    formRegister.appendChild(passwordInput);
    formRegister.appendChild(button);

    const header = document.querySelector('header'); 
    const registerLink = document.querySelector('a[href="#/register"]');
    registerLink.href = '#/register/'; 
    registerLink.innerText = 'Зареєструватися';
    
    registerLink.addEventListener('click', function(event){
        event.preventDefault();
        window.location.hash = '#/register';
       
    
    })
    header.appendChild(registerLink); 

   main.append(formRegister);
  
    // Обробник події відправки форми
    formRegister.addEventListener('submit', function (event) {
        event.preventDefault();
        const login = loginInput.value.trim();
        const password = passwordInput.value.trim();
        // Виклик функції з параметрами login та password
        actionFullRegister(login, password);
    
    });
    // Функція перевірки валідності форми
    const checkFormValidity = () => {
        const isFormValid = loginInput.value.trim() !== '' && passwordInput.value.trim() !== '';
        button.disabled = !isFormValid;
    };

    // Перевірка валідності при введенні даних
    loginInput.addEventListener('input', checkFormValidity);
    passwordInput.addEventListener('input', checkFormValidity);

    // Обробник події відправки форми
    formRegister.addEventListener('submit', function (event) {
        
        event.preventDefault();
        const login = loginInput.value.trim();
        const password = passwordInput.value.trim();
        store.dispatch(actionFullRegister(login, password)); 
    });
    main.appendChild(formRegister);
};
 

        

store.subscribe(() => {
    const [, route] = location.hash.split('/')
    if (route !== 'good') return

    const { status, payload, error } = store.getState().promise.goodById || {}
    if (status === 'PENDING') {
        main.innerHTML = `<img src='https://cdn.dribbble.com/users/63485/screenshots/1309731/infinite-gif-preloader.gif' />`
    }
    if (status === 'FULFILLED') {
        const { name, price, _id, description, images } = payload.GoodFindOne
        main.innerHTML = `
        <h3>${name}</h3>
        <p>${description}</p>
        <p>Ціна: ${price} грн.</p>
        <button id="add-to-cart-button"> Додати в кошик </button>`;

        const addButton = document.querySelector('#add-to-cart-button');
        const cartIcon = document.querySelector('#cartIcon');
        addButton.addEventListener('click', () => {
            // Виклик дії Redux для додавання товару до кошика
            store.dispatch(actionCartAdd({ id: _id, name, price, count }));
            
            // Оновлення кількості товарів у відображенні кошика
            const currentItemCount = parseInt(cartIcon.textContent);
            cartIcon.textContent = currentItemCount + 1;
        });
        
        for (const { url } of images || []) {
            main.innerHTML += `<div><img style= "max-width:25vw", "max-hight:25vh" src="http://shop-roles.node.ed.asmer.org.ua/${url}"></div>`
        }

    }
})

 







store.subscribe(() => {
    login.innerHTML = ('token' in store.getState().auth ? store.getState().auth.payload.sub.login : "Anna")
})



store.subscribe(() => {
    const { status, payload, error } = store.getState().promise.rootCats || {}
    if (status === 'FULFILLED' && payload) {
        aside.innerHTML = ''
        for (const { _id, name } of payload.CategoryFind) {
            aside.innerHTML += `<a href="#/category/${_id}">${name}</a>`
        }
    }
})

const gqlFullRegister = (login, password) =>
    gql(
        `
            mutation registration($login:String, $password:String){
                UserUpsert(user:{login:$login, password:$password}){
                   createdAt 
                   login
                 _id
                }
              }
            
        `,
        {
            "login": login,
            "password":password 
        }
    );

const gqlFullLogin = (login, password) =>
    gql(
        
        `
        query gqlFullLogin($login:String, $password:String){
        login(login:$login, password:$password)
    }`,
        {
            "login": login,
            "password": password
        }
    )

    const gqlLogin = (login, password) =>
    gql(
        
        `
        query gqlLogin($login:String, $password:String){
        login(login:$login, password:$password)
    }`,
        {
            "login": login,
            "password": password
        }
    )

    const gqlRootCats = () =>
    gql(       
        `
       
        {
            CategoryFind(query: "[{\\"parent\\": null}]") {
                _id
                name
            }
        }
    `)

const gqlCategoryById = (_id) =>
    gql(
         `
    query roots1($q1: String) {
    CategoryFindOne(query: $q1) {
      _id
      name
      goods {
        _id
        name
        price
        images {
          _id
          text
          url
          originalFileName
        }
      }
      image {
        _id
        text
        url
        originalFileName
      }
    }
  }
`,
        { q1: JSON.stringify([{ _id }]) }
    )

const gqlGoodById = (_id) =>
    gql(
         `
    query roots1($q1: String) {
    GoodFindOne(query: $q1) {
        _id
        name
        price
        description
        createdAt
        categories {
            _id
            createdAt
            name
        }
        images {
            _id
            createdAt
            text
            url
            originalFileName
        }
    }
  }
`,
        { q1: JSON.stringify([{ _id }]) }
    )

const gqlOrderFind =()=>
    gql(
        `query history {
            OrderFind($q1: "[{}]") {
              _id
              total
              owner {
                _id
                nick
                login
              }
              orderGoods {
                _id
                price
                count
                goodName
                total
                owner {
                  _id
                  nick
                }
              }
            }
          }
        `,
          
            { q1: JSON.stringify([{ }]) }
          
)





const actionRootCats = () =>
    actionPromise('rootCats', gqlRootCats())

store.dispatch(actionRootCats())

const actionCategoryById = (_id) =>
    actionPromise('categoryById', gqlCategoryById(_id))

const actionGoodById = (_id) =>
    actionPromise('goodById', gqlGoodById(_id))

const actionRegister = (login, password) => actionPromise('fullRegister', gqlFullRegister(login, password))

const actionLogin = (login, password) => actionPromise('fulllogin', gqlFullLogin(login, password))

const actionFullRegister = (login, password) => async (dispatch) => {
    try {
        const response = await dispatch(actionPromise('fullRegister', gqlFullRegister(login, password)));
        if (response.status === 'success') {
            await dispatch(actionFullLogin(login, password));
        } else {
            console.error('Помилка при реєстрації:', response.error);
        }
    } catch (error) {
        console.error('Помилка під час реєстрації:', error);
    }
};


const actionFullLogin = (login, password) => async dispatch => {
    try {  
        
        const token = await dispatch(actionPromise('fulllogin', gqlFullLogin(login, password)));
        console.log(token.login)
        if (typeof token.login === 'string') {
          
            dispatch(actionAuthLogin(token.login));
        } else {
           
            console.error('Отримано недійсний token');
               }
    } catch (error) {
        console.error('Помилка під час повного входу:', error);
        
    }
};



const actionOrderFind = (_id) => actionPromise('orderFind', gqlOrderFind(_id))

const actionPlaceOrder = (orderData) => async (dispatch) => {
    try {
        const response = await dispatch(actionPromise('placeOrder', gqlPlaceOrder(orderData)));
        if (response.status === 'success') {
            dispatch(actionCartClear());
        } else {
            console.error('Помилка при оформленні замовлення:', response.error);
        }
    } catch (error) {
        console.error('Помилка під час оформлення замовлення:', error);
    }
};

// const actionCartClear = () => {
//     return {
//         type: 'CART_CLEAR'
//     };
// };




window.onhashchange = () => {
    const [, route, _id] = location.hash.split('/')

    const routes = {

        category() {
            console.log("категория:", _id)
            store.dispatch(actionCategoryById(_id))
        },
        good() {
            //тут был store.dispatch goodById
            console.log('good', _id)
            store.dispatch(actionGoodById(_id))
        },
        login() {
            console.log('А ТУТ ЩА ДОЛЖНА БЫТЬ ФОРМА ЛОГИНА')
           main.innerHTML =`
           <input id ="login">
           <input id = "password">
           <button id ="loginButton">Увійти<button>
           <button id ="unloginbutton">Вийти<button>/
           <a href = '#/login'>Увійти<a>
           `
           
            document.getElementById('loginButton').addEventListener('click',()=>{
                const login = document.getElementById('login').value;
                const password = document.getElementById('password').value;
                
                store.dispatch(actionFullLogin(login,password))
            }
            )
            //нарисовать форму логина, которая по нажатию кнопки Login делает store.dispatch(actionFullLogin(login, password))
        },
        register() {
            
              drawRegisterForm()
          
            
            ////нарисовать форму регистрации, которая по нажатию кнопки Login делает store.dispatch(actionFullRegister(login, password))
            },
            logout() {
                const logoutButton = document.querySelector('a[href="#logout"]');
                const unloginButton = document.getElementById('unloginbutton');
                document.getElementById('unloginbutton').addEventListener('click', () => {
                    store.dispatch(actionAuthLogout());
                    window.location.hash = '#login';
                });
                unloginButton.addEventListener('click', () => {
                    store.dispatch(actionAuthLogout());
                    // Перенаправлення на сторінку логіну після розлогінення
                    window.location.hash = '#login';
                });
                
               
            },
            cart(){

            }
        }

    if(route in routes) {
            routes[route]()
        }
    }

    window.onhashchange()