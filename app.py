from datetime import datetime

from flask import Flask, jsonify, render_template, request
from flask_sqlalchemy import SQLAlchemy

from parser_bancos import extrair_dados_notificacao

app = Flask(__name__)

# Configuração do Banco de Dados SQLite local
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///financas.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)


# Função de auxílio para categorização automática
def identificar_categoria(local):
    local_upper = (local or "").upper()

    if "GUARIROBA" in local_upper or "AGUAS" in local_upper:
        return "Água"
    elif "ENERGISA" in local_upper:
        return "Luz"
    elif (
        "CONDOMINIO" in local_upper
        or "AGF" in local_upper
        or "GARANTIDORA" in local_upper
    ):
        return "Condomínio"
    elif (
        "COLECIONADORES" in local_upper
        or "ASSOCIACAO" in local_upper
        or "SEGURO" in local_upper
    ):
        return "Seguro"
    elif (
        "DIGITAL NET" in local_upper
        or "INTERNET" in local_upper
        or "FIBRA" in local_upper
    ):
        return "Internet"
    elif (
        "CLARO" in local_upper
        or "TIM" in local_upper
        or "VIVO" in local_upper
        or "CELULAR" in local_upper
    ):
        return "Celular"
    elif (
        "CAIXA" in local_upper
        or "MATHEUS FERNANDES DE FIGUEIREDO" in local_upper
        or "MATHEUS FERNANDES" in local_upper
    ):
        return "AP"
    else:
        return "Outros"


# Modelo do Banco SQL local
class Transacao(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    banco = db.Column(db.String(50))
    valor = db.Column(db.Float, nullable=False)
    local = db.Column(db.String(100), nullable=False)
    categoria = db.Column(db.String(50), default="Outros")
    data_hora = db.Column(db.DateTime, default=datetime.now)

    def to_dict(self):
        return {
            "id": self.id,
            "banco": self.banco,
            "valor": self.valor,
            "local": self.local,
            "categoria": self.categoria,
            "data_hora": self.data_hora.strftime("%d/%m/%Y %H:%M:%S"),
        }


with app.app_context():
    db.create_all()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/teste-notificacao", methods=["GET"])
def teste_notificacao():
    texto = request.args.get("texto", "")
    banco = request.args.get("banco", "C6")

    if not texto:
        return (
            jsonify(
                {
                    "erro": "Envie o texto na URL usando o parâmetro ?texto=",
                    "exemplo": "/api/teste-notificacao?texto=Pix+enviado+no+valor+de+R$+50,00+para+João",
                }
            ),
            400,
        )

    valor, local = extrair_dados_notificacao(texto, banco)
    categoria = identificar_categoria(local)

    return jsonify(
        {
            "status": "sucesso",
            "texto_original": texto,
            "banco": banco,
            "valor_extraido": valor,
            "local_extraido": local,
            "categoria_identificada": categoria,
        }
    )


# Rota Webhook (Notificações dos Bancos)
@app.route("/api/webhook", methods=["GET", "POST"])
def webhook():
    if request.method == "GET":
        texto = request.args.get("texto", "")
        banco = request.args.get("banco", "C6/PicPay")
    else:
        dados = request.get_json() or {}
        texto = dados.get("texto", "")
        banco = dados.get("banco", "C6/PicPay")

    if not texto:
        return jsonify({"erro": "Nenhum texto informado"}), 400

    # Extrai o valor e local usando o parser
    valor, local = extrair_dados_notificacao(texto, banco)

    # Classifica a categoria
    categoria = identificar_categoria(local)

    # Usa a hora local do servidor
    data_hora_atual = datetime.now()

    # Salva apenas no banco SQLite local
    nova_transacao = Transacao(
        banco=banco,
        valor=valor,
        local=local,
        categoria=categoria,
        data_hora=data_hora_atual,
    )
    db.session.add(nova_transacao)
    db.session.commit()

    return jsonify({"status": "sucesso", "transacao": nova_transacao.to_dict()}), 201


# Rota para Listagem e Lançamento Manual de Transações
@app.route("/api/transacoes", methods=["GET", "POST"])
def gerenciar_transacoes():
    if request.method == "POST":
        dados = request.get_json() or {}

        local = dados.get("local", "Desconhecido")
        valor = float(dados.get("valor", 0.0))
        banco = dados.get("banco", "C6/PicPay")
        categoria = dados.get("categoria") or identificar_categoria(local)

        data_hora_str = dados.get("data_hora")
        if data_hora_str:
            try:
                data_hora_obj = datetime.strptime(data_hora_str, "%d/%m/%Y %H:%M:%S")
            except ValueError:
                try:
                    data_hora_obj = datetime.strptime(data_hora_str, "%d/%m/%Y %H:%M")
                except ValueError:
                    data_hora_obj = datetime.now()
        else:
            data_hora_obj = datetime.now()

        nova_transacao = Transacao(
            banco=banco,
            valor=valor,
            local=local,
            categoria=categoria,
            data_hora=data_hora_obj,
        )
        db.session.add(nova_transacao)
        db.session.commit()

        return jsonify(
            {"status": "sucesso", "transacao": nova_transacao.to_dict()}
        ), 201

    # Método GET: Lista transações do mês selecionado
    mes_atual = datetime.now().strftime("%m")
    mes = request.args.get("mes", mes_atual)

    transacoes = Transacao.query.all()
    transacoes_filtradas = [
        t.to_dict()
        for t in transacoes
        if t.data_hora.strftime("%m") == str(mes).zfill(2)
    ]

    return jsonify(transacoes_filtradas)


# Rota para Resumo Mensal de Categorias
@app.route("/api/resumo", methods=["GET"])
def resumo_mensal():
    mes_atual = datetime.now().strftime("%m")
    mes = request.args.get("mes", mes_atual)

    transacoes = Transacao.query.all()
    transacoes_mes = [
        t for t in transacoes if t.data_hora.strftime("%m") == str(mes).zfill(2)
    ]

    totais = {
        "AP": 0.0,
        "Condomínio": 0.0,
        "Água": 0.0,
        "Luz": 0.0,
        "Internet": 0.0,
        "Celular": 0.0,
        "Seguro": 0.0,
        "Outros": 0.0,
        "Total": 0.0,
    }

    for t in transacoes_mes:
        cat = t.categoria if t.categoria in totais else "Outros"
        totais[cat] += t.valor
        totais["Total"] += t.valor

    return jsonify(totais)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
