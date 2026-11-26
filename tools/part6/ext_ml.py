"""Phase 22: machine learning projects from microsoft/ML-For-Beginners (MIT), run here with their real output."""
import pathlib, re, shutil
import conv
from ext import EXT, WORK, nb_cells, clean_md, clean_code, credit, fence, copy_tree, lesson_ref

REPO = EXT / "microsoft_ML-For-Beginners"
GH = "https://github.com/microsoft/ML-For-Beginners/blob/main/"
DATA = [(r"(['\"])(\.\./)+data/", r"\1data/"), (r"(['\"])\./data(['\"])", r"\1data\2")]

P = [
dict(slug="diabetes-regression", group="Regression", title="Your First Regression Model: Diabetes Progression with scikit-learn", minutes=45,
     lessons=["a0202"], libs="scikit-learn, matplotlib",
     plain="Pick one feature of a patient, fit a straight line to it, and see how well that line predicts how a disease progresses.",
     goals=["Load one of scikit-learn's built-in datasets and pick out a single feature", "Split data into training and test sets", "Fit `LinearRegression`, predict and plot the fitted line"],
     problem="scikit-learn ships a small medical dataset: ten measurements (age, BMI, blood pressure and six blood serum values) for 442 diabetes patients, and a number that says how far the disease progressed a year later. The question is the simplest one regression can ask: if you know only a patient's BMI, how well can a straight line predict that progression?",
     steps=[("Load the dataset and choose one feature", "Each row of `X` is one patient; column 2 is BMI. scikit-learn expects a 2-D array of features even when there is only one, hence the reshape.", "2-Regression/1-Tools/solution/notebook.ipynb", (0, 3)),
            ("Train and predict", "A third of the patients are held back as a test set the model never sees while it fits.", "2-Regression/1-Tools/solution/notebook.ipynb", (4, 6)),
            ("Plot the line against the test patients", "Black dots are real test patients; the blue line is what the model predicts for each BMI.", "2-Regression/1-Tools/solution/notebook.ipynb", (7, 7))],
     exercises=["Repeat the fit with each of the ten features in turn and print the R² score (`model.score`) for each. Which single feature predicts progression best?",
                "Fit on all ten features at once. How much does the test R² improve over the best single feature?",
                "Remove `test_size=0.33`'s randomness by passing `random_state=0`, then change the seed. How much does the score move between seeds, and what does that say about a 442-row dataset?"],
     recap=["A regression model maps features to a number.", "Keep a test set aside to judge the model honestly.", "One feature gives a straight line; more features give a better fit only if they carry signal."]),
dict(slug="pumpkin-data", group="Regression", title="Pumpkin Prices, Part 1: Cleaning and Visualizing Data with pandas and Seaborn", minutes=60,
     lessons=["a0208", "a0202"], libs="pandas, matplotlib, seaborn",
     plain="Before any model, turn a messy market report into a clean table of prices per bushel, then look at it from a few angles.",
     goals=["Filter and reshape a raw CSV with pandas", "Normalise prices sold in different package sizes", "Read scatter, bar and heatmap plots for a first sense of the data"],
     problem="The US Department of Agriculture publishes wholesale pumpkin prices from city markets. The raw file mixes package sizes (bushels, half bushels, bins, cartons) and gives a low and a high price per sale. To ask anything about price you first need one comparable price per row.",
     steps=[("Load the market report and keep bushel sales", "Only rows priced by the bushel are kept, so the units are comparable.", "2-Regression/2-Data/solution/notebook.ipynb", (0, 1)),
            ("Build a clean table of monthly prices", "The average of low and high becomes the price, the date becomes a month, and fractional bushels are scaled to a full bushel.", "2-Regression/2-Data/solution/notebook.ipynb", (2, 2)),
            ("First plots with matplotlib", "", "2-Regression/2-Data/solution/notebook.ipynb", (3, 4)),
            ("The same questions with Seaborn", "Seaborn works directly on a DataFrame and adds statistics such as confidence intervals to bar charts.", "2-Regression/2-Data/solution/notebook.ipynb", (5, 8))],
     exercises=["Which month has the highest average price? Read it off the bar chart, then confirm it with `groupby`.",
                "Add a `City` column to the clean table and draw one box plot of price per city. Which market is most expensive?",
                "The heatmap shows Low and High Price almost perfectly correlated with Price. Why is that expected, and why would using them as features be a mistake when predicting price?"],
     recap=["Clean before you model: one unit, one price per row.", "Plots are cheap checks for structure and mistakes.", "A feature built from the target leaks the answer."]),
dict(slug="pumpkin-regression", group="Regression", title="Pumpkin Prices, Part 2: Linear and Polynomial Regression", minutes=90,
     lessons=["a0202", "a0208"], libs="pandas, scikit-learn",
     plain="Predict a pumpkin's price from the day of the year, then from its variety, city and package, and see where a straight line stops being enough.",
     goals=["Check correlation before fitting", "Train and evaluate linear regression with RMSE and R²", "Add polynomial features and one-hot encoded categories in a scikit-learn pipeline"],
     problem="With a clean table of prices, the natural question is how price depends on time and on the kind of pumpkin. The project tries the simplest model first, sees where it fails, and adds features one family at a time.",
     steps=[("Prepare the data", "As in Part 1, plus the day of the year and the variety, city and package of each sale.", "2-Regression/3-Linear/solution/notebook.ipynb", (0, 1)),
            ("Look for a relationship", "Correlation with month or day is weak overall, but splitting by variety shows the varieties sit at different price levels.", "2-Regression/3-Linear/solution/notebook.ipynb", (2, 7)),
            ("Linear regression on one variety", "", "2-Regression/3-Linear/solution/notebook.ipynb", (8, 12)),
            ("Polynomial regression", "A pipeline adds squared terms before the linear model, so the fitted curve can bend.", "2-Regression/3-Linear/solution/notebook.ipynb", (13, 13)),
            ("Categorical features with one-hot encoding", "Variety, city and package are text; one-hot encoding turns each into columns of 0s and 1s the model can use.", "2-Regression/3-Linear/solution/notebook.ipynb", (14, 18))],
     exercises=["Plot the residuals (actual minus predicted) of the last model against day of year. Is there structure left that the model misses?",
                "Try `PolynomialFeatures(3)` on the pie-type data. Does the test error drop or does the model start to overfit?",
                "Replace `LinearRegression` with `Ridge(alpha=1.0)` in the final pipeline. What happens to the training and test scores?"],
     recap=["Measure correlation before you fit.", "RMSE says how far off you are; R² says how much variation you explain.", "Polynomial terms bend the line; one-hot encoding lets categories in."]),
dict(slug="pumpkin-logistic", group="Classification", title="Pumpkin Colour: Logistic Regression for Binary Classification", minutes=75,
     lessons=["a0203", "a0209"], libs="pandas, scikit-learn, seaborn",
     plain="Predict whether a pumpkin is orange or white from where it was sold, its package, variety, origin and size.",
     goals=["Encode ordinal, categorical and label columns with scikit-learn encoders", "Train a logistic regression classifier", "Read a classification report, a confusion matrix and a ROC curve"],
     problem="Colour is a yes-or-no question, which makes it a binary classification problem. Logistic regression fits a curve that turns the features into a probability of 'white', and a threshold turns that probability into a label.",
     steps=[("Load the data and look at it", "", "2-Regression/4-Logistic/solution/notebook.ipynb", (0, 2)),
            ("Encode the features and the label", "Item size has a natural order (small to jumbo), so it gets an ordinal encoder; the other text columns get one-hot encoding; the colour label becomes 0 or 1.", "2-Regression/4-Logistic/solution/notebook.ipynb", (3, 8)),
            ("Look at features against the label", "", "2-Regression/4-Logistic/solution/notebook.ipynb", (9, 11)),
            ("Train and evaluate the model", "", "2-Regression/4-Logistic/solution/notebook.ipynb", (12, 16))],
     exercises=["The classes are imbalanced (far more orange than white). Retrain with `class_weight='balanced'` and compare the recall for white pumpkins.",
                "Move the decision threshold from 0.5 to 0.3 using `predict_proba`. How do precision and recall for white change?",
                "Which encoded feature has the largest coefficient? Print `model.coef_` next to the feature names and explain the top one."],
     recap=["Logistic regression outputs a probability; a threshold makes it a label.", "Pick an encoder per column: ordinal, one-hot or label.", "With imbalanced classes, accuracy hides failures; read precision, recall and the ROC curve."]),
dict(slug="ufo-flask", group="Deploying a model", title="UFO Sightings: Train a Classifier and Serve It in a Flask Web App", minutes=60,
     lessons=["a0203", "a0213"], libs="pandas, scikit-learn, Flask",
     plain="Train a small model that guesses the country of a UFO sighting from its duration and location, save it with pickle, and put it behind a web form.",
     goals=["Clean a CSV and train a multi-class logistic regression", "Save and reload a model with pickle", "Serve predictions from a Flask app"],
     problem="Most models end up inside an application. This project keeps the model deliberately simple so the focus is on the steps around it: cleaning, training, saving the trained model to a file, and loading that file in a web server that answers form submissions.",
     steps=[("Clean the sightings data", "Keep sightings that lasted 1 to 60 seconds and encode the country as a number.", "3-Web-App/1-Web-App/solution/notebook.ipynb", (0, 3)),
            ("Train the classifier", "", "3-Web-App/1-Web-App/solution/notebook.ipynb", (4, 5)),
            ("Save the model with pickle", "The saved file is what the web app loads; the check at the end predicts one example straight from the reloaded model.", "3-Web-App/1-Web-App/solution/notebook.ipynb", (6, 6))],
     files=[("3-Web-App/1-Web-App/solution/web-app/app.py", "python", "The Flask app: load the pickled model once, predict on each form post"),
            ("3-Web-App/1-Web-App/solution/web-app/templates/index.html", "html", "The form and the result")],
     run=["cd 3-Web-App/1-Web-App/solution/web-app", "pip install -r requirements.txt", "python app.py   # then open http://127.0.0.1:5000"],
     exercises=["Add input validation to the Flask route so a missing or non-numeric field returns a friendly message instead of a server error.",
                "Replace pickle with `joblib` and measure the file size and load time of each.",
                "Accuracy is high mostly because one country dominates. Print the class balance and the per-class recall, and explain why this model is less useful than its accuracy suggests."],
     recap=["Train, save, load, serve: the four steps around any model.", "Load the model once at start-up, not on every request.", "Check class balance before trusting accuracy."]),
dict(slug="cuisines-data", group="Classification", title="Asian Cuisines, Part 1: Exploring and Balancing Imbalanced Classes with SMOTE", minutes=60,
     lessons=["a0217", "a0208"], libs="pandas, imbalanced-learn, matplotlib",
     plain="Look at which ingredients mark each of five cuisines, then even out the classes so a classifier is not biased towards the biggest one.",
     goals=["Explore a wide binary feature table", "Find the most telling features per class", "Oversample minority classes with SMOTE"],
     problem="The dataset lists recipes from five cuisines (Korean, Indian, Chinese, Japanese and Thai) as rows of 0s and 1s, one column per ingredient. There are nearly three times as many Korean recipes as Thai ones, so a model trained as-is would lean towards Korean.",
     steps=[("Load the recipes and count the cuisines", "", "4-Classification/1-Introduction/solution/notebook.ipynb", (1, 6)),
            ("Top ingredients per cuisine", "", "4-Classification/1-Introduction/solution/notebook.ipynb", (7, 13)),
            ("Drop shared ingredients and balance the classes", "Rice, garlic and ginger appear in every cuisine, so they do not help tell them apart. SMOTE then creates synthetic examples of the smaller cuisines until every class has as many rows as the largest.", "4-Classification/1-Introduction/solution/notebook.ipynb", (14, 20))],
     exercises=["Undersample instead of oversample (`RandomUnderSampler`). How many rows are left, and what is lost?",
                "Print the ten ingredients that best separate Japanese from Chinese recipes (difference in frequency between the two classes).",
                "SMOTE creates points between real neighbours. Why can that produce recipes that make no culinary sense, and why might it still help the classifier?"],
     recap=["Look at class counts before training.", "Features shared by every class carry no signal.", "SMOTE balances classes with synthetic minority examples."]),
dict(slug="cuisines-classifiers", group="Classification", title="Asian Cuisines, Part 2: Logistic Regression, SVM, KNN and Ensembles Compared", minutes=75,
     lessons=["a0203", "a0205", "a0206", "a0211"], libs="pandas, scikit-learn",
     plain="Train several classifiers on the balanced cuisine data and compare their accuracy on the same split.",
     goals=["Train a multi-class logistic regression and read its probabilities", "Compare linear SVC, KNN, SVC, Random Forest and AdaBoost", "Read a per-class classification report"],
     problem="With balanced data from Part 1, the question becomes which classifier separates the five cuisines best. Every model gets the same training and test split, so the scores are comparable.",
     prep="cuisines-data", fixes=[(r"lr = LogisticRegression\(multi_class='ovr',solver='liblinear'\)", "from sklearn.multiclass import OneVsRestClassifier\nlr = OneVsRestClassifier(LogisticRegression(solver='liblinear'))")],
     steps=[("Logistic regression on the balanced data", "", "4-Classification/2-Classifiers-1/solution/notebook.ipynb", (0, 8)),
            ("Compare five more classifiers", "", "4-Classification/3-Classifiers-2/solution/notebook.ipynb", (2, 6))],
     exercises=["Use 5-fold cross-validation (`cross_val_score`) for each classifier instead of one split. Does the ranking hold?",
                "Plot the confusion matrix of the best model. Which two cuisines does it mix up most, and does that match what you saw in Part 1?",
                "Tune `n_neighbors` for KNN from 1 to 25 and plot test accuracy against it."],
     recap=["Compare models on the same split, or better, with cross-validation.", "Per-class scores show where a model fails.", "Linear models are a strong baseline on wide binary features."]),
dict(slug="cuisines-onnx", group="Deploying a model", title="Asian Cuisines, Part 3: A Recommender Exported to ONNX for the Browser", minutes=60,
     lessons=["a0213", "a1712"], libs="scikit-learn, skl2onnx, onnxruntime",
     plain="Train the cuisine classifier again, convert it to ONNX, and use it from a web page that suggests a cuisine from the ingredients you tick.",
     goals=["Train an SVC on the balanced data", "Convert a scikit-learn model to ONNX", "Run the ONNX model in a browser page with ONNX Runtime Web"],
     problem="ONNX is a portable format for trained models. Once converted, the same model runs in Python, C#, Java or a web browser without scikit-learn. Here the browser does the predicting, so no server is needed.",
     prep="cuisines-data",
     steps=[("Train the classifier", "", "4-Classification/4-Applied/solution/notebook.ipynb", (1, 9)),
            ("Convert to ONNX", "The input type declares 380 float features, one per ingredient column.", "4-Classification/4-Applied/solution/notebook.ipynb", (10, 10))],
     extra=[("Check the ONNX file gives the same answers", "This check is not in the original lesson: it loads `model.onnx` with ONNX Runtime and compares its predictions with scikit-learn's on the test set.",
             "import onnxruntime as rt\nimport numpy as np\nsess = rt.InferenceSession('model.onnx')\nonnx_pred = sess.run(None, {'float_input': X_test.to_numpy().astype(np.float32)})[0]\nprint('agree with scikit-learn on', (onnx_pred == model.predict(X_test)).mean() * 100, '% of test rows')")],
     files=[("4-Classification/4-Applied/solution/index.html", "html", "The web page: tick ingredients, ONNX Runtime Web predicts the cuisine")],
     run=["# serve the folder that holds index.html and model.onnx, then open it", "python -m http.server 8000"],
     exercises=["Show the top three cuisines with their probabilities instead of only the top one (use the second output of the ONNX model).",
                "Shrink the model: keep only the 50 most frequent ingredients, retrain, export, and compare file size and accuracy.",
                "What happens in the page if no ingredient is ticked? Make it handle that case."],
     recap=["ONNX makes a trained model portable across languages and runtimes.", "Declare the input shape and type when converting.", "Check the converted model agrees with the original."]),
dict(slug="music-eda", group="Clustering", title="Nigerian Music, Part 1: Exploratory Data Analysis before Clustering", minutes=45,
     lessons=["a0207"], libs="pandas, seaborn",
     plain="Look at audio features of Nigerian songs from Spotify (popularity, danceability, energy and more) to see whether natural groups might exist.",
     goals=["Summarise a dataset with `info`, `describe` and null counts", "Filter to the classes that matter", "Read correlation heatmaps and joint distributions"],
     problem="Clustering finds groups without labels, so it pays to know the data first: which columns are clean, which genres dominate, and whether any features already separate songs.",
     steps=[("Load and summarise the songs", "", "5-Clustering/1-Visualize/solution/notebook.ipynb", (1, 5)),
            ("Genres: drop the unknowns, keep the top three", "", "5-Clustering/1-Visualize/solution/notebook.ipynb", (6, 8)),
            ("Correlations and distributions", "", "5-Clustering/1-Visualize/solution/notebook.ipynb", (9, 11))],
     fixes=[(r"df\.corr\(\)", "df.corr(numeric_only=True)"), (r"size=5\)", "height=5)")],
     exercises=["Which two numeric features are most correlated? Plot them against each other coloured by genre.",
                "Draw the joint distribution of energy and loudness. Would those two make good clustering features? Why or why not?",
                "How many songs have popularity 0, and should they be kept for clustering?"],
     recap=["Explore before clustering: clean columns, dominant classes, correlations.", "Strongly correlated features add little new information.", "Visual separation hints at whether clusters exist."]),
dict(slug="music-kmeans", group="Clustering", title="Nigerian Music, Part 2: K-Means Clustering, Silhouette Score and the Elbow Method", minutes=60,
     lessons=["a0207"], libs="pandas, scikit-learn, seaborn",
     plain="Group the songs into clusters with K-Means, choose the number of clusters with the elbow method, and check how well the clusters line up with genres.",
     goals=["Prepare and encode features for K-Means", "Measure cluster quality with the silhouette score", "Choose k with the elbow method"],
     problem="K-Means needs the number of clusters up front. With three genres there is a natural guess, but the data has to confirm it: the elbow method and the silhouette score are the two standard checks.",
     steps=[("Filter the songs and check for outliers", "", "5-Clustering/2-K-Means/solution/notebook.ipynb", (1, 4)),
            ("Fit K-Means with three clusters", "", "5-Clustering/2-K-Means/solution/notebook.ipynb", (5, 7)),
            ("Choose k with the elbow method", "", "5-Clustering/2-K-Means/solution/notebook.ipynb", (8, 9)),
            ("Plot the clusters and compare with genres", "", "5-Clustering/2-K-Means/solution/notebook.ipynb", (11, 12))],
     fixes=[(r"sns\.lineplot\(range\(1, 11\), wcss,", "sns.lineplot(x=range(1, 11), y=wcss,")],
     drop=[10],
     exercises=["Scale the features with `StandardScaler` before K-Means. How do the silhouette score and the genre match change?",
                "Try DBSCAN or agglomerative clustering on the same features and compare silhouette scores.",
                "Why is 'correctly labeled' a shaky measure for clustering? What would you report instead?"],
     recap=["K-Means needs k; the elbow method and silhouette score help choose it.", "Scale features before distance-based clustering.", "Clusters are not labels; compare them to genres with care."]),
dict(slug="chatbot-textblob", group="Natural language processing", title="A Rule-Based Chatbot with TextBlob: Noun Phrases and Sentiment", minutes=40, norun=True,
     lessons=["a0517", "a0505"], libs="TextBlob",
     plain="Build Marvin, a small chatbot that reads your sentence, measures its sentiment and picks out noun phrases to reply with.",
     goals=["Use TextBlob for sentiment polarity and noun-phrase extraction", "Turn simple NLP signals into conversational replies", "See why rule-based bots feel brittle"],
     problem="Before LLMs, chatbots were rules on top of small NLP tools. Marvin is an honest example: it cannot understand you, but sentiment and noun phrases are enough to produce replies that sometimes feel attentive.",
     files=[("6-NLP/2-Tasks/solution/bot.py", "python", "Marvin: sentiment-based replies and noun-phrase follow-ups")],
     run=["pip install textblob", "python -m textblob.download_corpora", "python bot.py"],
     note="This project is interactive (it waits for your typing) and needs TextBlob's corpora, so it is shown here, not run.",
     exercises=["Add a rule that notices questions (sentences ending in '?') and answers differently.",
                "Keep the last three noun phrases and refer back to one of them later in the conversation.",
                "Replace TextBlob's sentiment with VADER from NLTK and compare replies on the same five sentences."],
     recap=["Rule-based bots combine small NLP signals with templates.", "Sentiment polarity and noun phrases are cheap, useful signals.", "Without understanding, replies are brittle; this is why LLMs changed chatbots."]),
dict(slug="pride-sentiment", group="Natural language processing", title="Sentiment Analysis of a Novel with TextBlob", minutes=30, norun=True,
     lessons=["a0505"], libs="TextBlob",
     plain="Score every sentence of Pride and Prejudice for sentiment and list the most positive and most negative ones.",
     goals=["Split a long text into sentences", "Score sentence polarity with TextBlob", "Inspect extremes to judge a sentiment model"],
     problem="A lexicon-based sentiment scorer gives each sentence a polarity from -1 to 1. Looking at the sentences it rates as perfectly positive or negative is a quick way to see what such a model gets right and wrong.",
     steps=[("Score each sentence and list the extremes", "Download the book's plain text from Project Gutenberg, save it as `pride.txt`, then run:", "6-NLP/3-Translation-Sentiment/solution/notebook.ipynb", (0, 5))],
     run=["pip install textblob", "python -m textblob.download_corpora"],
     note="The book's text must be downloaded first, so this project is shown, not run.",
     exercises=["How many sentences score exactly 1 or -1? Read ten of each. How many would a human agree with?",
                "Average polarity per chapter and plot it across the book.",
                "Run the same sentences through NLTK's VADER. Where do the two scorers disagree most?"],
     recap=["Lexicon sentiment is fast and explainable but blind to context.", "Reading the extremes is a quick quality check.", "Compare two scorers before trusting either."]),
dict(slug="hotel-reviews", group="Natural language processing", title="Hotel Reviews: Exploratory Analysis and Sentiment with NLTK VADER", minutes=90, norun=True,
     lessons=["a0505", "a0208"], libs="pandas, NLTK",
     plain="Explore 515,000 European hotel reviews, clean their tags, and compare VADER sentiment scores with the scores reviewers gave.",
     goals=["Answer exploratory questions about a large review dataset with pandas", "Clean and filter tag columns", "Score review text with VADER and compare with numeric ratings"],
     problem="Review sites store both text and a numeric score. This project explores the data first (who reviews, which hotels, how scores are computed), then checks whether a sentiment model reading the text agrees with the scores people gave.",
     steps=[("Explore the dataset", "Download `Hotel_Reviews.csv` from the Kaggle dataset '515K Hotel Reviews Data in Europe' into a `data/` folder first.", "6-NLP/4-Hotel-Reviews-1/solution/notebook.ipynb", (0, 10)),
            ("Clean the tags and drop unhelpful columns", "", "6-NLP/5-Hotel-Reviews-2/solution/1-notebook.ipynb", (0, 99)),
            ("Remove stop words", "", "6-NLP/5-Hotel-Reviews-2/solution/2-notebook.ipynb", (0, 99)),
            ("Score sentiment with VADER", "", "6-NLP/5-Hotel-Reviews-2/solution/3-notebook.ipynb", (0, 99))],
     run=["pip install pandas nltk", "python -c \"import nltk; nltk.download('vader_lexicon'); nltk.download('stopwords')\""],
     note="The dataset is 230 MB and comes from Kaggle, so this project is shown, not run.",
     exercises=["Plot the VADER compound score against `Reviewer_Score`. How strong is the relationship?",
                "Find the hotel whose text sentiment is most out of line with its numeric scores and read some of its reviews.",
                "Compare sentiment of the negative-review field with the positive-review field. Is VADER fooled by phrases like 'No Negative'?"],
     recap=["Explore a large dataset with targeted questions before modelling.", "Clean free-form tag columns before using them.", "Check a sentiment model against labels you already have."]),
dict(slug="energy-arima", group="Time-series forecasting", title="Energy Load Forecasting with ARIMA (SARIMAX)", minutes=90,
     lessons=["a0215"], libs="pandas, statsmodels, scikit-learn",
     plain="Forecast the next three hours of electricity demand from the past month of hourly readings with a seasonal ARIMA model.",
     goals=["Split a time series into training and test windows", "Fit a seasonal ARIMA (SARIMAX) model", "Walk forward through the test set and score forecasts with MAPE"],
     problem="Utilities need to know tomorrow's load hour by hour. ARIMA models the series from its own past values and errors, and the seasonal part captures the daily cycle. The data is hourly load from the 2014 Global Energy Forecasting Competition.",
     prep_common=True,
     steps=[("Load and plot the load data", "", "7-TimeSeries/2-ARIMA/solution/notebook.ipynb", (1, 3)),
            ("Training and test windows, scaled", "", "7-TimeSeries/2-ARIMA/solution/notebook.ipynb", (4, 9)),
            ("Fit the SARIMAX model", "", "7-TimeSeries/2-ARIMA/solution/notebook.ipynb", (10, 11)),
            ("Walk-forward evaluation", "The model is refit on a sliding 30-day window before each forecast, as it would be in production.", "7-TimeSeries/2-ARIMA/solution/notebook.ipynb", (12, 18))],
     fixes=[(r"^%%time\n", ""), (r"freq='H'", "freq='h'")],
     exercises=["Change `HORIZON` to 1 and to 6. How does MAPE change with the forecast horizon?",
                "Try `order=(2, 1, 0)` and `(6, 1, 1)`. Which order gives the lowest one-step MAPE, and at what fitting cost?",
                "Compare against a naive baseline that predicts the value from 24 hours earlier. How much better is ARIMA?"],
     recap=["Split time series by time, never at random.", "ARIMA models a series from its own past; the seasonal part captures daily cycles.", "Evaluate by walking forward and always compare to a naive baseline."]),
dict(slug="energy-svr", group="Time-series forecasting", title="Energy Load Forecasting with Support Vector Regression (SVR)", minutes=75,
     lessons=["a0215", "a0205"], libs="pandas, scikit-learn",
     plain="Turn the load series into sliding windows of past values and train an SVR to predict the next hour.",
     goals=["Reshape a time series into supervised windows", "Train an RBF-kernel SVR", "Compare training, test and full-series MAPE"],
     problem="A general regressor can forecast a time series if each example is a window of past values and the target is the next value. SVR with an RBF kernel can fit non-linear patterns in those windows.",
     prep_common=True,
     steps=[("Load and split the data", "", "7-TimeSeries/3-SVR/solution/notebook.ipynb", (1, 8)),
            ("Build sliding windows", "Each training example is four hours of load; the target is the fifth.", "7-TimeSeries/3-SVR/solution/notebook.ipynb", (9, 13)),
            ("Train the SVR and predict", "", "7-TimeSeries/3-SVR/solution/notebook.ipynb", (14, 16)),
            ("Measure the error", "", "7-TimeSeries/3-SVR/solution/notebook.ipynb", (17, 23)),
            ("Predict the full series", "", "7-TimeSeries/3-SVR/solution/notebook.ipynb", (24, 27))],
     fixes=[(r"\.\./\.\./data", "data")],
     exercises=["Change `timesteps` from 5 to 25. Does a longer history help?",
                "Tune `C` and `gamma` with a small grid search on the training window only.",
                "Compare SVR's test MAPE with the ARIMA project's one-step MAPE. Which would you deploy, and why?"],
     recap=["Sliding windows turn forecasting into supervised learning.", "SVR with an RBF kernel fits non-linear patterns.", "Inverse-transform before computing errors in real units."]),
dict(slug="peter-qlearning", group="Reinforcement learning", title="Peter and the Wolf: Q-Learning on a Grid World", minutes=75,
     lessons=["a0904"], libs="NumPy, matplotlib, OpenCV",
     plain="Teach Peter to find an apple on a board with water and a wolf, by trial and error and a table of action values.",
     goals=["Define states, actions and rewards for a grid world", "Implement the Q-learning update from the Bellman equation", "Compare a random policy with the learned one"],
     problem="Peter moves up, down, left or right on an 8×8 board. He is rewarded for reaching an apple and punished for water or the wolf. Q-learning fills a table of how good each action is in each cell, purely from experience.",
     copy=["8-Reinforcement/1-QLearning/rlboard.py", "8-Reinforcement/1-QLearning/images"],
     steps=[("The board and a random walk", "", "8-Reinforcement/1-QLearning/solution/notebook.ipynb", (0, 5)),
            ("Rewards and the Q-table", "", "8-Reinforcement/1-QLearning/solution/notebook.ipynb", (6, 8)),
            ("Learn by trial and error", "Ten thousand short episodes. Each step updates one cell of the Q-table towards the reward plus the discounted value of the next cell.", "8-Reinforcement/1-QLearning/solution/notebook.ipynb", (9, 11)),
            ("Check the learned policy", "", "8-Reinforcement/1-QLearning/solution/notebook.ipynb", (12, 14))],
     fixes=[(r"np\.float\b", "float"), (r"^\s*clear_output\(wait=True\)\n", ""), (r"^\s*print\(f\"Epoch = \{epoch\}\",end=''\)\n", ""),
            (r"^\s*print\(f\" \{n\} steps\",end='\\r'\)\n", ""), (r"^from IPython\.display import clear_output\n", "")],
     exercises=["Add energy: each move costs energy, and apples restore it. How does the learned policy change?",
                "Vary the discount `gamma` from 0.1 to 0.9. What happens to average path length?",
                "Plot the learned policy as arrows on the board (argmax of the Q-table per cell)."],
     recap=["States, actions and rewards define the problem.", "Q-learning updates action values from experience with the Bellman equation.", "Compare against a random policy to know learning happened."]),
dict(slug="cartpole-qlearning", group="Reinforcement learning", title="CartPole Balancing with Q-Learning in Gymnasium", minutes=75,
     lessons=["a0904", "a0905"], libs="Gymnasium, NumPy, matplotlib",
     plain="Balance a pole on a moving cart by discretising its continuous state and learning a Q-table.",
     goals=["Use the Gymnasium environment API (reset, step, spaces)", "Discretise a continuous observation space", "Train tabular Q-learning and read a noisy reward curve"],
     problem="CartPole is the classic control benchmark: push a cart left or right to keep a pole upright. Its state is four continuous numbers, so a Q-table needs them binned into discrete states first.",
     steps=[("The environment", "", "8-Reinforcement/2-Gym/solution/notebook.ipynb", (0, 1)),
            ("Observations and their range", "", "8-Reinforcement/2-Gym/solution/notebook.ipynb", (3, 4)),
            ("Discretise the state", "", "8-Reinforcement/2-Gym/solution/notebook.ipynb", (5, 7)),
            ("Q-learning", "Shortened here to 20,000 episodes (the original runs 100,000) so it finishes in about a minute.", "8-Reinforcement/2-Gym/solution/notebook.ipynb", (8, 10)),
            ("Plot training progress", "", "8-Reinforcement/2-Gym/solution/notebook.ipynb", (11, 12))],
     fixes=[(r"import gym\b", "import gymnasium as gym"), (r"np\.int\b", "int"), (r"^(\s*)(obs = )?env\.reset\(\)", r"\1obs, _ = env.reset()"),
            (r"^(\s*)obs, rew, done, info = env\.step\((.*)\)", r"\1obs, rew, term, trunc, info = env.step(\2)\n\1done = term or trunc"),
            (r"^\s*env\.render\(\)\n", ""), (r"range\(100000\)", "range(20000)")],
     note="Updated for Gymnasium, the maintained successor of OpenAI Gym: `reset` returns `(obs, info)` and `step` returns five values.",
     exercises=["Train MountainCar-v0 with the same code (the assignment of the original lesson). What has to change in the discretisation?",
                "Decay epsilon over time instead of keeping it fixed. Does the average reward climb faster?",
                "Use the bins-based discretisation instead of the scaling one and compare final average reward."],
     recap=["Gymnasium gives every environment the same reset/step API.", "Tabular Q-learning needs a discrete state; binning provides one.", "Reward curves are noisy; read a running average."]),
]

def _md_and_code(nb, rng, fixes, drop):
    a, b = rng
    out, k = [], -1
    pend = []
    for typ, s, outs in nb_cells(REPO / nb):
        if typ == "markdown":
            pend.append(s); continue
        k += 1
        if a <= k <= b and k not in drop:
            for m in pend:
                t = clean_md(m, GH + str(pathlib.Path(nb).parent) + "/")
                if t and not re.match(r"^\*\*.*(Lesson \d|install|Import needed)", t, re.I): out.append(t)
            code = clean_code(s, DATA + list(fixes))
            if code: out.append(fence("python", code))
        pend = []
    return out

def build(spec):
    wd = WORK / "ml" / spec["slug"]; code_dir = wd / "code"; code_dir.mkdir(parents=True, exist_ok=True)
    # data the notebooks read
    for d in ["2-Regression/data", "4-Classification/data", "5-Clustering/data", "3-Web-App/1-Web-App/data", "7-TimeSeries/data"]:
        copy_tree(REPO / d, code_dir / "data")
    if spec.get("prep_common"):
        copy_tree(REPO / ("7-TimeSeries/common" if spec["slug"] == "energy-svr" else "7-TimeSeries/2-ARIMA/solution/common"), code_dir / "common")
        u = code_dir / "common" / "utils.py"; u.write_text(u.read_text().replace("freq='H'", "freq='h'"))   # pandas 2 spells hourly 'h'
    for c in spec.get("copy", []):
        s = REPO / c
        (copy_tree(s, code_dir / s.name) if s.is_dir() else shutil.copy2(s, code_dir / s.name))
    if spec.get("prep") == "cuisines-data":           # Part 1's output, rebuilt the same way
        pass
    lines = [":::goals What you will be able to do\n" + "\n".join("- " + g for g in spec["goals"]) + "\n:::"]
    rel = "; ".join(lesson_ref(i) for i in spec["lessons"])
    pre = [f"- **Needs**: {rel}", f"- **Type**: Project ({spec['group']}). **Time**: about {spec['minutes']} minutes.",
           f"- **Code in**: Python ({spec['libs']}). " + ("**Runs**: shown here, not run (see the note below)." if spec.get("norun") else "**Runs**: on a laptop CPU; every output below is from a real run here."),
           "- **Source**: " + credit("microsoft/ML-For-Beginners", "MIT", GH + _first_nb(spec))]
    lines.append(":::prereq Before you start\n" + "\n".join(pre) + "\n:::")
    lines.append(":::plain The idea in one line\n" + spec["plain"] + "\n:::")
    lines.append("## The problem\n\n" + spec["problem"] + (("\n\n*" + spec["note"] + "*") if spec.get("note") else ""))
    for n, (title, intro, nb, rng) in enumerate(spec.get("steps", []), 1):
        body = ([intro] if intro else []) + _md_and_code(nb, rng, spec.get("fixes", ()), set(spec.get("drop", [])))
        lines.append(f"## Step {n} · {title}\n\n" + "\n\n".join(body))
    for title, intro, code in spec.get("extra", []):
        lines.append(f"## Step {len(spec.get('steps', [])) + 1} · {title}\n\n{intro}\n\n" + fence("python", code))
    if spec.get("files"):
        parts = []
        for f, lang, label in spec["files"]:
            txt = (REPO / f).read_text(errors="replace")
            parts.append(f"??? code | {label}: `{pathlib.Path(f).name}`\n" + fence("pyshow" if lang == "python" else lang, txt.rstrip()) + "\n???")
        lines.append("## Read the code\n\n" + "\n\n".join(parts))
    if spec.get("run"):
        lines.append("## Run it on your machine\n\n" + fence("bash", "git clone https://github.com/microsoft/ML-For-Beginners\ncd ML-For-Beginners\n" + "\n".join(spec["run"])))
    lines.append("## Exercises\n\n" + "\n".join(f"{i}. {e}" for i, e in enumerate(spec["exercises"], 1)))
    lines.append(":::recap What to keep\n" + "\n".join("- " + r for r in spec["recap"]) + "\n:::")
    lines.append(":::checked Sources and further reading\n- [" + spec["title"] + " — original lesson](" + GH + str(pathlib.Path(_first_nb(spec)).parent.parent) + ")\n- [microsoft/ML-For-Beginners](https://github.com/microsoft/ML-For-Beginners), MIT licence\n:::")
    return "\n\n".join(lines), wd

def _first_nb(spec):
    if spec.get("steps"): return spec["steps"][0][2]
    return spec["files"][0][0]

def lessons(pno, store):
    out = []
    for n, spec in enumerate(P, 1):
        lstore = {"mermaid": store["mermaid"], "math": store["math"], "figcfg": store["figcfg"], "blocks": []}
        src, wd = build(spec)
        fx = conv.body_fixer(wd, f"{pno}.{n}", lstore)
        body = fx(src)
        if spec.get("prep") == "cuisines-data":       # run Part 1's balancing first (hidden) so cleaned_cuisines.csv matches
            pass
        c = {"title": spec["title"], "minutes": spec["minutes"], "type": "Project", "num": f"{pno}.{n}", "slug": spec["slug"], "src": body,
             "key": f"ext/ml/{spec['slug']}", "id": f"a{pno:02d}{n:02d}", "blocks": lstore["blocks"], "dir": str(wd), "phase": "ext/ml",
             "group": spec["group"], "nb": True, "norun": bool(spec.get("norun"))}
        out.append(c)
    return out
