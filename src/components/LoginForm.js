import React from "react";
import "./css/loginForm.css";
import firebase from "firebase/app";
import SpritjaktClient from "../datahandlers/spritjaktClient";

class LoginForm extends React.Component {

    constructor(){
        super();
        this.state = { status: null, message:""}
        this.spritjaktClient = new SpritjaktClient();
    }
    register = (event) => {
        event.preventDefault();
        const email =  event.target[0].value;
        const pass =  event.target[1].value;
        const pass2 =  event.target[2].value;

        if(email === ""){
            this.setState({status: false, message: "Passordet må være på minst 6 tegn"});
            return;
        }
        if(pass.length <= 5){
            this.setState({status: false, message: "Passordet må være på minst 6 tegn"});
            return;
        }
        if(pass !== pass2){
            this.setState({status: false, message: "Passordene er ikke like"});
            return;
        }

        firebase.auth().createUserWithEmailAndPassword(email, pass)
        .then(async () => {
            
            await this.spritjaktClient.CreateUserDoc();

            this.setState({status: true, message: "Registrering vellykket"});
        })    
        .catch((error) => {
            this.setState({status: false, message: error.message});
        });
    }
    login = (event) => {
        event.preventDefault();

        const email =  event.target[0].value;
        const pass =  event.target[1].value;
        
        firebase.auth().signInWithEmailAndPassword(email, pass)
        .then(() => {
            this.setState({status: true, message: "Innlogging vellykket"});
        })    
        .catch((error) => {
            this.setState({status: false, message: error.message});
        });
    }

  render() {
    return (
        <div>
            <h2>{this.props.heading}</h2>
            <form className="loginForm" onSubmit={ this.props.justLogin ? this.login : this.register}>
                <label>
                    Epost
                    <br/>
                    <input required placeholder="Din epostadresse" name="email" type="email" />
                </label>
                <label>
                    Passord
                    <br/>
                    <input required name="pass" type="password" />
                </label>
                { !this.props.justLogin && 
                    <label>
                        Bekreft passord
                        <br/>
                        <input required name="pass2" type="password" />
                    </label>
                }
                <br />
                {this.state.status != null &&
                    <div className={"statusMessage" + this.state.status ? " success" : " error"}>
                        {this.state.message}
                    </div>
                }
                <input className="bigGreenBtn" type="submit" value={this.props.heading} />
            </form>
        </div>
    );
  }
}

export default LoginForm;
