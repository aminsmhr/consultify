import "./Input.scss";

function Input({ label, name, type = "text",onChange, checked }) {
  return (
    <div className="field">
      <label htmlFor={name} className="field__label">
        {label}
      </label>
      <input type={type} id={name} name={name} className="field__input" checked={checked} onChange={onChange}/>
    </div>
  );
}

export default Input;
